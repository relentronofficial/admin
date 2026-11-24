/**
 * queryData — lets the admin assistant answer questions no fixed tool covers
 * (rank, compare, combine, trend) without ever writing SQL.
 *
 * The model fills in a small form: dataset, columns, filters, grouping, order.
 * Every name in it is looked up in the catalogue below and every value is a
 * bound parameter, so nothing the model writes reaches the database as SQL.
 * The catalogue holds only what may go to the AI service: no phone, email,
 * address, KYC, notes, message text or credentials. It runs read-only with a
 * time limit. Company-wide, so admins and super admins only.
 *
 * Dates: every date/time is an IST calendar date or IST text.
 */
import type { AdminToolCtx } from './adminTools.js';
import { ToolError, type AssistantTool } from './registry.js';

type Kind = 'text' | 'number' | 'date' | 'bool';
interface Column {
  kind: Kind;
  sql: string;
  about?: string;
}
interface Dataset {
  about: string;
  from: string;
  where?: string;
  columns: Record<string, Column>;
}

const t = (sql: string, about?: string): Column => ({ kind: 'text', sql: `(${sql})::text`, about });
const num = (sql: string, about?: string): Column => ({ kind: 'number', sql: `(${sql})::numeric`, about });
const bool = (sql: string, about?: string): Column => ({ kind: 'bool', sql: `(${sql})`, about });
/** A moment, kept as IST wall-clock time. */
const at = (sql: string, about?: string): Column => ({ kind: 'date', sql: `((${sql})::timestamptz AT TIME ZONE 'Asia/Kolkata')`, about });
/** A calendar date with no time. */
const day = (sql: string, about?: string): Column => ({ kind: 'date', sql: `(${sql})::date::timestamp`, about });

const NAME = (m: string) => `TRIM(CONCAT(${m}.first_name, ' ', ${m}.last_name))`;
const who = {
  member: t(NAME('m')),
  member_code: t('m.member_id', 'unique per member'),
  member_status: t('m.status', 'active, inactive, paused, suspended, pending'),
  batch: t('b.name', "the member's current batch"),
  mentor: t('am.full_name', 'account manager'),
};
const MEMBER_JOINS = 'LEFT JOIN batches b ON b.id = m.batch_id LEFT JOIN admins am ON am.id = m.account_manager_id';

export const datasets: Record<string, Dataset> = {
  members: {
    about: 'One row per member (deleted members excluded).',
    from: `members m ${MEMBER_JOINS} LEFT JOIN programs p ON p.id = b.program_id`,
    where: 'm.deleted_at IS NULL',
    columns: {
      ...who,
      plan: t('m.membership_plan', 'free, starter, premium, vip, enterprise'),
      program: t('p.name'),
      verification: t('m.verification_status', 'awaiting_kyc, under_review, verified, rejected, changes_requested'),
      onboarding_completed: bool('m.onboarding_completed'),
      city: t('m.city'),
      state: t('m.state'),
      business_name: t('m.business_name'),
      business_type: t('m.business_type'),
      joined_at: at('m.created_at', 'account created'),
      last_active_at: at('m.last_active_at', 'empty = never active'),
      current_streak: num('m.current_streak'),
      courses_enrolled: num('SELECT COUNT(*) FROM course_enrollments e JOIN courses ec ON ec.id = e.course_id WHERE e.member_id = m.id AND ec.deleted_at IS NULL', 'courses started'),
      courses_completed: num('SELECT COUNT(*) FROM course_enrollments e JOIN courses ec ON ec.id = e.course_id WHERE e.member_id = m.id AND ec.deleted_at IS NULL AND e.completed_at IS NOT NULL'),
      lessons_completed: num('SELECT COUNT(*) FROM course_episode_progress ep WHERE ep.member_id = m.id AND ep.completed'),
      days_submitted: num('SELECT COUNT(*) FROM member_day_progress dp WHERE dp.member_id = m.id AND dp.submitted_at IS NOT NULL', 'batch programme days'),
      total_paid_inr: num("(SELECT COALESCE(SUM(cp.amount), 0) FROM course_payments cp WHERE cp.member_id = m.id AND cp.status = 'completed') + (SELECT COALESCE(SUM(co.amount_paise), 0) / 100.0 FROM coin_orders co WHERE co.member_id = m.id AND co.status = 'paid') + (SELECT COALESCE(SUM(cr.amount_inr), 0) FROM credit_purchases cr WHERE cr.member_id = m.id AND cr.status = 'approved')", 'all money received from the member'),
      open_tickets: num("SELECT COUNT(*) FROM helpdesk_tickets ht WHERE ht.member_id = m.id AND ht.status IN ('new', 'acknowledged', 'in_progress', 'waiting_for_user')"),
    },
  },
  batches: {
    about: 'One row per batch.',
    from: 'batches b LEFT JOIN programs p ON p.id = b.program_id',
    columns: {
      batch: t('b.name'),
      program: t('p.name'),
      is_active: bool('b.is_active'),
      starts_on: at('b.starts_at'),
      ends_on: at('b.ends_at'),
      total_days: num('COALESCE(b.snapshot_days, p.duration_days)'),
      members: num('SELECT COUNT(*) FROM members bm WHERE bm.batch_id = b.id AND bm.deleted_at IS NULL'),
      active_members: num("SELECT COUNT(*) FROM members bm WHERE bm.batch_id = b.id AND bm.deleted_at IS NULL AND bm.status = 'active'"),
      days_waiting_approval: num("SELECT COUNT(*) FROM member_day_progress dp WHERE dp.batch_id = b.id AND dp.status = 'pending_approval'"),
    },
  },
  courses: {
    about: 'One row per course.',
    from: 'courses c',
    where: 'c.deleted_at IS NULL',
    columns: {
      course: t('c.title'),
      course_type: t('c.course_type', 'mentorship or mini_course'),
      module: t('c.module', 'Product = E-commerce, Service, Coaching = CoachX'),
      is_published: bool('c.is_published'),
      price_inr: num('c.price', 'empty = free'),
      created_at: at('c.created_at'),
      lessons: num('SELECT COUNT(*) FROM course_episodes ce WHERE ce.course_id = c.id AND ce.is_visible'),
      enrolled: num('SELECT COUNT(*) FROM course_enrollments e JOIN members em ON em.id = e.member_id WHERE e.course_id = c.id AND em.deleted_at IS NULL'),
      completed: num('SELECT COUNT(*) FROM course_enrollments e JOIN members em ON em.id = e.member_id WHERE e.course_id = c.id AND em.deleted_at IS NULL AND e.completed_at IS NOT NULL'),
      revenue_inr: num("SELECT COALESCE(SUM(cp.amount), 0) FROM course_payments cp WHERE cp.course_id = c.id AND cp.status = 'completed'", 'all time'),
    },
  },
  enrollments: {
    about: 'One row per member per course they started.',
    from: `course_enrollments e JOIN members m ON m.id = e.member_id JOIN courses c ON c.id = e.course_id ${MEMBER_JOINS}`,
    where: 'm.deleted_at IS NULL AND c.deleted_at IS NULL',
    columns: {
      ...who,
      course: t('c.title'),
      course_type: t('c.course_type', 'mentorship or mini_course'),
      module: t('c.module'),
      enrolled_at: at('e.enrolled_at'),
      completed_at: at('e.completed_at'),
      is_completed: bool('e.completed_at IS NOT NULL'),
      lessons_completed: num('SELECT COUNT(*) FROM course_episode_progress ep JOIN course_episodes ce ON ce.id = ep.episode_id WHERE ce.course_id = e.course_id AND ep.member_id = e.member_id AND ep.completed'),
      lessons_total: num('SELECT COUNT(*) FROM course_episodes ce WHERE ce.course_id = e.course_id AND ce.is_visible'),
    },
  },
  lesson_progress: {
    about: 'One row per member per lesson they opened.',
    from: `course_episode_progress ep JOIN course_episodes ce ON ce.id = ep.episode_id JOIN courses c ON c.id = ce.course_id JOIN members m ON m.id = ep.member_id ${MEMBER_JOINS}`,
    where: 'm.deleted_at IS NULL AND c.deleted_at IS NULL',
    columns: {
      ...who,
      course: t('c.title'),
      lesson: t('ce.title'),
      lesson_order: num('ce."order"'),
      is_completed: bool('ep.completed'),
      completed_at: at('ep.completed_at'),
      watched_minutes: num('ROUND(ep.actual_watched_secs / 60.0, 1)'),
      first_opened_at: at('ep.created_at'),
    },
  },
  course_access: {
    about: 'One row per member per course they have permission to watch, whether or not they started.',
    from: `course_access ca JOIN members m ON m.id = ca.member_id JOIN courses c ON c.id = ca.course_id ${MEMBER_JOINS}`,
    where: 'm.deleted_at IS NULL AND c.deleted_at IS NULL',
    columns: {
      ...who,
      course: t('c.title'),
      access_type: t('ca.access_type', 'lifetime or duration'),
      is_valid: bool('ca.is_active AND (ca.expires_at IS NULL OR ca.expires_at > NOW())', 'can watch now'),
      granted_at: at('ca.granted_at'),
      expires_at: at('ca.expires_at'),
      has_started: bool('EXISTS (SELECT 1 FROM course_enrollments e WHERE e.member_id = ca.member_id AND e.course_id = ca.course_id)'),
      days_to_expiry: num("CASE WHEN ca.expires_at IS NULL THEN NULL ELSE (ca.expires_at::timestamptz AT TIME ZONE 'Asia/Kolkata')::date - (NOW() AT TIME ZONE 'Asia/Kolkata')::date END"),
    },
  },
  revenue: {
    about: 'Money TBT has received: one row per successful payment (courses, coins, credits). Use this for any revenue total, ranking or trend.',
    from: `(SELECT COALESCE(cp.paid_at, cp.created_at) AS received_at, cp.amount::numeric AS amount, cp.member_id, 'courses' AS source, cp.method::text AS method, cp.course_id FROM course_payments cp WHERE cp.status = 'completed'
       UNION ALL SELECT COALESCE(co.paid_at, co.created_at), co.amount_paise / 100.0, co.member_id, 'coins', 'razorpay', NULL::uuid FROM coin_orders co WHERE co.status = 'paid'
       UNION ALL SELECT COALESCE(cr.reviewed_at, cr.created_at), cr.amount_inr::numeric, cr.member_id, 'credits', 'manual', NULL::uuid FROM credit_purchases cr WHERE cr.status = 'approved') r
      LEFT JOIN courses c ON c.id = r.course_id LEFT JOIN members m ON m.id = r.member_id ${MEMBER_JOINS}`,
    columns: {
      ...who,
      received_at: at('r.received_at'),
      amount_inr: num('r.amount'),
      source: t('r.source', 'courses, coins, credits'),
      method: t('r.method'),
      course: t('c.title'),
      module: t('c.module'),
    },
  },
  course_payments: {
    about: 'Every course payment attempt, including pending, failed and refunded. Not for revenue totals.',
    from: `course_payments cp LEFT JOIN courses c ON c.id = cp.course_id LEFT JOIN members m ON m.id = cp.member_id ${MEMBER_JOINS}`,
    columns: {
      ...who,
      course: t('c.title'),
      status: t('cp.status', 'pending, completed, refunded, failed'),
      method: t('cp.method'),
      payment_type: t('cp.payment_type'),
      amount_inr: num('cp.amount'),
      created_at: at('cp.created_at'),
      paid_at: at('cp.paid_at'),
    },
  },
  day_progress: {
    about: 'Batch programme: one row per member per day they worked on.',
    from: `member_day_progress dp JOIN members m ON m.id = dp.member_id JOIN batches b ON b.id = dp.batch_id LEFT JOIN admins am ON am.id = m.account_manager_id`,
    where: 'm.deleted_at IS NULL',
    columns: {
      ...who,
      batch: t('b.name', 'the batch the day belongs to'),
      day_number: num('dp.day_number'),
      status: t('dp.status', 'not_started, in_progress, pending_approval, approved, rejected'),
      submitted_at: at('dp.submitted_at'),
      reviewed_at: at('dp.reviewed_at'),
      hours_to_review: num('ROUND((EXTRACT(EPOCH FROM (dp.reviewed_at::timestamptz - dp.submitted_at::timestamptz)) / 3600)::numeric, 1)'),
    },
  },
  task_submissions: {
    about: 'One row per task a member submitted.',
    from: `task_submissions ts JOIN members m ON m.id = ts.member_id JOIN tasks tk ON tk.id = ts.task_id ${MEMBER_JOINS}`,
    where: 'm.deleted_at IS NULL',
    columns: {
      ...who,
      task: t('tk.title'),
      day_number: num('COALESCE(ts.day_number, tk.day_number)'),
      status: t('ts.status', 'pending, approved, rejected, resubmission_required'),
      submitted_at: at('ts.created_at'),
      reviewed_at: at('ts.reviewed_at'),
    },
  },
  tickets: {
    about: 'One row per support ticket.',
    from: `helpdesk_tickets ht LEFT JOIN helpdesk_categories hc ON hc.id = ht.category_id LEFT JOIN admins ta ON ta.id = ht.assigned_to LEFT JOIN members m ON m.id = ht.member_id ${MEMBER_JOINS}`,
    columns: {
      ...who,
      ticket_number: num('ht.display_number'),
      subject: t('LEFT(ht.subject, 120)'),
      status: t('ht.status', 'new, acknowledged, in_progress, waiting_for_user, resolved, closed'),
      priority: t('ht.priority', 'low, medium, high, urgent'),
      category: t('hc.name'),
      assigned_to: t('ta.full_name', 'empty = nobody'),
      created_at: at('ht.created_at'),
      resolved_at: at('ht.resolved_at'),
      deadline: at('ht.resolve_deadline'),
      is_open: bool("ht.status IN ('new', 'acknowledged', 'in_progress', 'waiting_for_user')"),
      is_overdue: bool("COALESCE(ht.status IN ('new', 'acknowledged', 'in_progress', 'waiting_for_user') AND ht.resolve_deadline::timestamptz < NOW(), false)"),
      hours_to_resolve: num('ROUND((EXTRACT(EPOCH FROM (ht.resolved_at::timestamptz - ht.created_at::timestamptz)) / 3600)::numeric, 1)'),
    },
  },
  support_calls: {
    about: 'One row per support-call slot.',
    from: 'support_call_sessions s LEFT JOIN admins ha ON ha.id = s.host_admin_id',
    columns: {
      title: t('s.title'),
      category: t('s.category', 'sales_support, tech_support, content_support, ad_support, one_to_one, group_call'),
      host: t('COALESCE(ha.full_name, s.host_name)'),
      starts_at: at('s.starts_at'),
      duration_minutes: num('s.duration_minutes'),
      capacity: num('s.capacity'),
      status: t('s.status', 'scheduled, completed, cancelled'),
      booked: num("SELECT COUNT(*) FROM support_call_bookings sb WHERE sb.session_id = s.id AND sb.status <> 'cancelled'"),
      attended: num("SELECT COUNT(*) FROM support_call_bookings sb WHERE sb.session_id = s.id AND sb.status = 'attended'"),
    },
  },
  call_bookings: {
    about: 'One row per member booking of a support call.',
    from: `support_call_bookings sb JOIN support_call_sessions s ON s.id = sb.session_id JOIN members m ON m.id = sb.member_id LEFT JOIN admins ha ON ha.id = s.host_admin_id ${MEMBER_JOINS}`,
    where: 'm.deleted_at IS NULL',
    columns: {
      ...who,
      category: t('s.category'),
      host: t('COALESCE(ha.full_name, s.host_name)'),
      starts_at: at('s.starts_at'),
      status: t('sb.status', 'booked, cancelled, attended, no_show'),
      booked_at: at('sb.booked_at'),
    },
  },
  business_revenue: {
    about: "Members' own business figures, self-reported weekly. Not TBT's revenue.",
    from: `member_revenue_reports rr JOIN members m ON m.id = rr.member_id ${MEMBER_JOINS}`,
    where: 'm.deleted_at IS NULL',
    columns: {
      ...who,
      year: num('rr.year'),
      week_number: num('rr.week_number', 'ISO week'),
      week_start: day("to_date(rr.year::text || '-' || rr.week_number::text, 'IYYY-IW')", 'Monday of the week'),
      revenue_inr: num('rr.revenue_generated'),
      orders: num('rr.number_of_orders'),
      ad_spend_inr: num('rr.ad_budget_spent'),
      leads: num('rr.organic_leads'),
    },
  },
  points: {
    about: 'TBT points ledger: one row per time a member earned or spent points.',
    from: `tbt_activity_log al JOIN members m ON m.id = al.member_id ${MEMBER_JOINS}`,
    where: 'm.deleted_at IS NULL',
    columns: {
      ...who,
      points: num('al.points'),
      source: t('al.source'),
      activity_date: day('al.activity_date'),
    },
  },
};

const OPS = ['=', '!=', '>', '>=', '<', '<=', 'in', 'not_in', 'contains', 'is_empty', 'not_empty'] as const;
type Op = (typeof OPS)[number];
const COMPARE = new Set<Op>(['=', '!=', '>', '>=', '<', '<=']);
const METRICS = ['count', 'count_distinct', 'sum', 'avg', 'min', 'max', 'percent_true'] as const;
const BUCKETS = ['day', 'week', 'month', 'year'] as const;
const MAX_LIMIT = 100;

export interface CompiledQuery {
  sql: string;
  countSql: string;
  /** Metrics over everything the filters match, when the query is grouped. */
  overallSql: string | null;
  params: string[];
  limit: number;
}

function own<T>(o: Record<string, T>, k: unknown): T | undefined {
  return typeof k === 'string' && Object.hasOwn(o, k) ? o[k] : undefined;
}

function strings(v: unknown, name: string, max: number): string[] {
  if (v == null) return [];
  if (!Array.isArray(v) || v.length > max || v.some((x) => typeof x !== 'string')) throw new ToolError(`"${name}" must be a list of up to ${max} texts.`);
  return v as string[];
}

function validDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function compileQuery(raw: unknown): CompiledQuery {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ToolError('"query" must be an object.');
  const q = raw as Record<string, unknown>;
  for (const k of Object.keys(q)) {
    if (!['dataset', 'select', 'filters', 'group_by', 'metrics', 'having', 'order_by', 'limit'].includes(k)) throw new ToolError(`Unknown key "${k}".`);
  }
  const ds = own(datasets, q.dataset);
  if (!ds) throw new ToolError(`Unknown dataset. Use one of: ${Object.keys(datasets).join(', ')}.`);
  const col = (name: unknown): Column => {
    const c = own(ds.columns, name);
    if (!c) throw new ToolError(`"${String(name).slice(0, 40)}" is not a column of ${q.dataset}. Columns: ${Object.keys(ds.columns).join(', ')}.`);
    return c;
  };

  const params: string[] = [];
  const bind = (v: string, cast: string) => {
    params.push(v);
    return `$${params.length}::${cast}`;
  };

  /** One comparison. `sql` is trusted; the value is always bound. */
  const condition = (sql: string, kind: Kind, op: unknown, value: unknown): string => {
    if (!OPS.includes(op as Op)) throw new ToolError(`Unknown operator. Use one of: ${OPS.join(' ')}.`);
    const o = op as Op;
    if (o === 'is_empty' || o === 'not_empty') {
      const empty = kind === 'text' ? `NULLIF(TRIM(${sql}), '')` : sql;
      return `${empty} IS ${o === 'is_empty' ? '' : 'NOT '}NULL`;
    }
    const lhs = kind === 'text' ? `LOWER(TRIM(${sql}))` : kind === 'date' ? `(${sql})::date` : sql;
    const one = (v: unknown): string => {
      if (kind === 'number') {
        const n = typeof v === 'string' && v.trim() ? Number(v) : v;
        if (typeof n !== 'number' || !Number.isFinite(n)) throw new ToolError('That column needs a number.');
        return bind(String(n), 'numeric');
      }
      if (kind === 'bool') {
        if (v !== true && v !== false && v !== 'true' && v !== 'false') throw new ToolError('That column needs true or false.');
        return bind(String(v), 'boolean');
      }
      if (typeof v !== 'string' || v.length > 200) throw new ToolError('That column needs a text value.');
      if (kind === 'date') {
        if (!validDate(v)) throw new ToolError('Dates must be real dates written YYYY-MM-DD.');
        return bind(v, 'date');
      }
      return bind(v.trim().toLowerCase(), 'text');
    };
    if (o === 'contains') {
      if (kind !== 'text' || typeof value !== 'string' || !value.trim()) throw new ToolError('"contains" needs a text column and a text value.');
      return `${lhs} LIKE ${bind(`%${value.trim().toLowerCase().replace(/[\\%_]/g, '\\$&')}%`, 'text')}`;
    }
    if (o === 'in' || o === 'not_in') {
      if (!Array.isArray(value) || value.length === 0 || value.length > 50) throw new ToolError(`"${o}" needs a list of 1 to 50 values.`);
      const list = value.map(one).join(', ');
      return o === 'in' ? `${lhs} IN (${list})` : `(${lhs} IS NULL OR ${lhs} NOT IN (${list}))`;
    }
    if (!COMPARE.has(o)) throw new ToolError('Unsupported operator.');
    if ((kind === 'bool' || kind === 'text') && o !== '=' && o !== '!=') throw new ToolError(`"${o}" does not work on that column.`);
    return o === '!=' ? `${lhs} IS DISTINCT FROM ${one(value)}` : `${lhs} ${o} ${one(value)}`;
  };

  const readFilters = (v: unknown, name: string) => {
    if (v == null) return [];
    if (!Array.isArray(v) || v.length > 12) throw new ToolError(`"${name}" must be a list of up to 12 conditions.`);
    return v.map((f) => {
      if (!f || typeof f !== 'object') throw new ToolError(`Each item of "${name}" needs field, op and value.`);
      return f as { field?: unknown; op?: unknown; value?: unknown };
    });
  };

  const where = ds.where ? [ds.where] : [];
  for (const f of readFilters(q.filters, 'filters')) {
    const c = col(f.field);
    where.push(condition(c.sql, c.kind, f.op, f.value));
  }

  // Output columns: name → SQL. Names come from the catalogue, never from the model.
  const groups = strings(q.group_by, 'group_by', 4);
  const metricSpecs = strings(q.metrics, 'metrics', 8);
  const grouped = groups.length > 0 || metricSpecs.length > 0;
  const out = new Map<string, { sql: string; kind: Kind }>();
  const show = (c: Column) => (c.kind === 'date' ? `to_char(${c.sql}, 'YYYY-MM-DD HH24:MI')` : c.kind === 'number' ? `(${c.sql})::float8` : c.sql);

  const groupSql: string[] = [];
  const metricOut: string[] = [];
  if (grouped) {
    if (q.select != null && strings(q.select, 'select', 20).length) throw new ToolError('Use either "select" (rows) or "group_by"/"metrics" (totals), not both.');
    for (const g of groups) {
      const [name, bucket] = g.split(':');
      const c = col(name);
      if (bucket != null) {
        if (c.kind !== 'date' || !BUCKETS.includes(bucket as never)) throw new ToolError(`Group dates as column:${BUCKETS.join('|')}.`);
        const sql = `to_char(date_trunc('${bucket}', ${c.sql}), 'YYYY-MM-DD')`;
        out.set(`${name}_${bucket}`, { sql, kind: 'text' });
        groupSql.push(sql);
      } else {
        const sql = c.kind === 'date' ? `to_char(${c.sql}, 'YYYY-MM-DD')` : show(c);
        out.set(name, { sql, kind: c.kind === 'date' ? 'text' : c.kind });
        groupSql.push(sql);
      }
    }
    for (const spec of metricSpecs.length ? metricSpecs : ['count']) {
      const [fn, name] = spec.split(':');
      if (!METRICS.includes(fn as never)) throw new ToolError(`Unknown metric. Use one of: ${METRICS.join(', ')}, as fn:column.`);
      let sql: string;
      let key = fn;
      let kind: Kind = 'number';
      if (fn === 'count' && !name) sql = 'COUNT(*)::float8';
      else {
        const c = col(name);
        key = `${fn}_${name}`;
        if (fn === 'count') sql = `COUNT(${c.sql})::float8`;
        else if (fn === 'count_distinct') sql = `COUNT(DISTINCT ${c.sql})::float8`;
        else if (fn === 'percent_true') {
          if (c.kind !== 'bool') throw new ToolError('percent_true needs a true/false column.');
          sql = `ROUND(100.0 * COUNT(*) FILTER (WHERE ${c.sql}) / NULLIF(COUNT(*), 0), 1)::float8`;
        } else if (fn === 'sum' || fn === 'avg') {
          if (c.kind !== 'number') throw new ToolError(`${fn} needs a number column.`);
          sql = fn === 'sum' ? `COALESCE(ROUND(SUM(${c.sql}), 2), 0)::float8` : `ROUND(AVG(${c.sql}), 2)::float8`;
        } else {
          if (c.kind === 'bool' || c.kind === 'text') throw new ToolError(`${fn} needs a number or date column.`);
          const agg = `${fn.toUpperCase()}(${c.sql})`;
          sql = c.kind === 'date' ? `to_char(${agg}, 'YYYY-MM-DD HH24:MI')` : `(${agg})::float8`;
          if (c.kind === 'date') kind = 'text';
        }
      }
      out.set(key, { sql, kind });
      metricOut.push(key);
    }
  } else {
    const sel = strings(q.select, 'select', 20);
    if (sel.length === 0) throw new ToolError('Give "select" (rows) or "metrics"/"group_by" (totals).');
    for (const s of sel) {
      const c = col(s);
      out.set(s, { sql: show(c), kind: c.kind });
    }
  }

  // The overall totals ignore "having": they cover everything the filters match.
  const fromWhere = `FROM ${ds.from}${where.length ? ` WHERE ${where.join(' AND ')}` : ''}`;
  const overallParams = params.length;
  const having: string[] = [];
  for (const h of readFilters(q.having, 'having')) {
    const key = String(h.field).replace(':', '_');
    if (!metricOut.includes(key)) throw new ToolError(`"having" works on the metrics: ${metricOut.join(', ') || 'none asked for'}.`);
    const m = out.get(key)!;
    if (m.kind !== 'number') throw new ToolError('"having" needs a number metric.');
    having.push(condition(`(${m.sql})::numeric`, 'number', h.op, h.value));
  }

  const names = [...out.keys()];
  const order = strings(q.order_by, 'order_by', 4).map((o) => {
    const [rawName, dir = 'asc', extra] = o.trim().split(/\s+/);
    if (extra || !/^(asc|desc)$/i.test(dir)) throw new ToolError('Write order_by items as "column desc" or "column asc".');
    const name = rawName.replace(':', '_');
    if (out.has(name)) {
      // Order dates and text by their shown form: ISO text sorts as time does.
      return `${names.indexOf(name) + 1} ${dir.toUpperCase()} NULLS LAST`;
    }
    if (grouped) throw new ToolError(`order_by must be one of: ${names.join(', ')}.`);
    return `${col(rawName).sql} ${dir.toUpperCase()} NULLS LAST`;
  });
  // Ties stay in the same order every time.
  if (names.length) order.push(...names.map((_, i) => `${i + 1}`).slice(0, 3));

  const limit = q.limit ?? 25;
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) throw new ToolError(`"limit" must be 1 to ${MAX_LIMIT}.`);

  const list = names.map((n) => `${out.get(n)!.sql} AS "${n}"`).join(', ');
  const body = `SELECT ${list} ${fromWhere}${groupSql.length ? ` GROUP BY ${groupSql.map((_, i) => i + 1).join(', ')}` : ''}${having.length ? ` HAVING ${having.join(' AND ')}` : ''}`;
  return {
    sql: `${body} ORDER BY ${order.join(', ')} LIMIT ${limit}`,
    countSql: `SELECT COUNT(*)::int AS total FROM (${body}) x`,
    overallSql: groups.length && overallParams === params.length
      ? `SELECT ${metricOut.map((n) => `${out.get(n)!.sql} AS "${n}"`).join(', ')} ${fromWhere}`
      : null,
    params,
    limit,
  };
}

/** Runs read-only, with a database-side time limit. */
export async function runCompiled(c: AdminToolCtx, q: CompiledQuery) {
  const p = c.prisma;
  const [, , rows, count, overall] = (await p.$transaction([
    p.$executeRawUnsafe('SET TRANSACTION READ ONLY'),
    p.$executeRawUnsafe('SET LOCAL statement_timeout = 8000'),
    p.$queryRawUnsafe(q.sql, ...q.params),
    p.$queryRawUnsafe(q.countSql, ...q.params),
    ...(q.overallSql ? [p.$queryRawUnsafe(q.overallSql, ...q.params)] : []),
  ] as any)) as any[];
  return { total: Number(count?.[0]?.total ?? 0), showing: rows.length, rows, ...(overall ? { overall_all_groups: overall[0] } : {}) };
}

export function catalogue(): string {
  return Object.entries(datasets).map(([name, d]) =>
    `${name}: ${d.about} Columns: ${Object.entries(d.columns).map(([n, c]) => `${n} (${c.kind}${c.about ? `: ${c.about}` : ''})`).join('; ')}.`).join('\n');
}

const listOfText = (description: string) => ({ type: 'array', items: { type: 'string' }, description });
const conditions = (description: string) => ({
  type: 'array', description,
  items: {
    type: 'object',
    properties: { field: { type: 'string' }, op: { type: 'string', enum: [...OPS] }, value: { description: 'Text, number, true/false, or a list for in/not_in. Leave out for is_empty/not_empty.' } },
    required: ['field', 'op'],
  },
});

export const queryDataTool: AssistantTool<AdminToolCtx> = {
  name: 'queryData',
  description: `Look up anything in TBT's data that the other tools do not answer exactly: newest/oldest, top/bottom, counts by group, trends by month, comparisons, combined conditions. Run it several times to combine results. Filters are joined with AND; text matches ignore case; dates are IST YYYY-MM-DD and include the whole day. "total" is the real number of rows/groups, "showing" how many are listed; overall_all_groups covers every group.

Examples
Newest 5 members: {"dataset":"members","select":["member","batch","joined_at"],"order_by":["joined_at desc"],"limit":5}
Revenue by month: {"dataset":"revenue","group_by":["received_at:month"],"metrics":["sum:amount_inr","count"],"order_by":["received_at_month asc"]}
Completion rate by batch: {"dataset":"enrollments","group_by":["batch"],"metrics":["count","percent_true:is_completed"],"order_by":["percent_true_is_completed desc"]}
Active members who never started a course: {"dataset":"members","select":["member","batch","joined_at"],"filters":[{"field":"member_status","op":"=","value":"active"},{"field":"courses_enrolled","op":"=","value":0}]}

Datasets
${catalogue()}`,
  params: {
    query: {
      type: 'json',
      required: true,
      description: 'The query.',
      schema: {
        type: 'object',
        properties: {
          dataset: { type: 'string', enum: Object.keys(datasets) },
          select: listOfText('Columns to list, for rows.'),
          filters: conditions('Conditions, all must hold.'),
          group_by: listOfText('Columns to group by; dates as column:day|week|month|year.'),
          metrics: listOfText(`Totals per group (or overall): count, or fn:column with fn ${METRICS.slice(1).join(', ')}.`),
          having: conditions('Conditions on metrics, e.g. field "count" or "sum_amount_inr".'),
          order_by: listOfText('e.g. "joined_at desc" or "sum_amount_inr desc".'),
          limit: { type: 'integer', minimum: 1, maximum: MAX_LIMIT },
        },
        required: ['dataset'],
      },
    },
  },
  allowed: (c) => c.admin.role === 'super_admin' || c.admin.role === 'admin',
  async run(c, a) {
    return runCompiled(c, compileQuery(JSON.parse(String(a.query))));
  },
};

/** Runs every column of every dataset once. Reports only names, never data. */
export async function selfTest(c: AdminToolCtx, onError: (dataset: string, err: unknown) => void) {
  const failed: string[] = [];
  for (const [name, d] of Object.entries(datasets)) {
    const cols = Object.keys(d.columns);
    try {
      for (let i = 0; i < cols.length; i += 20) await runCompiled(c, compileQuery({ dataset: name, select: cols.slice(i, i + 20), limit: 1 }));
      const dates = cols.filter((n) => d.columns[n].kind === 'date');
      const numbers = cols.filter((n) => d.columns[n].kind === 'number');
      await runCompiled(c, compileQuery({
        dataset: name,
        group_by: dates[0] ? [`${dates[0]}:month`] : [cols[0]],
        metrics: ['count', ...(numbers[0] ? [`sum:${numbers[0]}`, `avg:${numbers[0]}`] : [])],
        order_by: ['count desc'],
      }));
    } catch (err) {
      failed.push(name);
      onError(name, err);
    }
  }
  return { datasets: Object.keys(datasets).length, failed };
}
