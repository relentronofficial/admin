import { describe, expect, it } from 'vitest';
import {
  buildMemberAnalyticsCountQuery,
  buildMemberAnalyticsQuery,
  parseMemberAnalyticsFilters,
} from './memberAnalyticsQuery.js';

const WEEK = new Date('2026-11-15T18:30:00.000Z');
const UUID = '0b6f5c1e-8a2d-4c3b-9f1e-2d3c4b5a6f70';

describe('parseMemberAnalyticsFilters', () => {
  it('defaults', () => {
    const f = parseMemberAnalyticsFilters({});
    expect(f).toMatchObject({ search: '', status: null, plan: null, batchId: null, courseId: null, activity: 'any', weeklyReport: 'any', rangeDays: 30, sort: 'last_active', order: 'desc', page: 1, limit: 25 });
  });

  it('drops values outside the allowed sets', () => {
    const f = parseMemberAnalyticsFilters({ status: 'deleted', plan: "x'; drop", batchId: 'nope', activity: 'weird', sort: 'password', order: 'up', rangeDays: '12' });
    expect(f).toMatchObject({ status: null, plan: null, batchId: null, activity: 'any', sort: 'last_active', order: 'desc', rangeDays: 30 });
  });

  it('keeps valid values and clamps paging', () => {
    const f = parseMemberAnalyticsFilters({ status: 'active', plan: 'premium', batchId: UUID, courseId: UUID, activity: 'inactive_7d', sort: 'video_minutes', order: 'asc', rangeDays: '90', page: '-3', limit: '99999' }, 500);
    expect(f).toMatchObject({ status: 'active', plan: 'premium', batchId: UUID, courseId: UUID, activity: 'inactive_7d', sort: 'video_minutes', order: 'asc', rangeDays: 90, page: 1, limit: 500 });
  });
});

describe('buildMemberAnalyticsQuery', () => {
  it('passes every user value as a parameter, never inline', () => {
    const f = parseMemberAnalyticsFilters({ search: "o'brien%", status: 'active', plan: 'premium', batchId: UUID, courseId: UUID, page: '3', limit: '10' });
    const { sql, params } = buildMemberAnalyticsQuery(f, 'Asia/Kolkata', WEEK);
    expect(sql).not.toContain("o'brien");
    expect(params).toContain("%o'brien\\%%");
    expect(params).toEqual(expect.arrayContaining(['active', 'premium', UUID, 10, 20]));
    expect(sql).toContain('m.deleted_at IS NULL');
    // every $n placeholder has a value
    const max = Math.max(...[...sql.matchAll(/\$(\d+)/g)].map((m) => Number(m[1])));
    expect(max).toBe(params.length);
  });

  it('activity presets filter on last_active_at', () => {
    const never = buildMemberAnalyticsQuery(parseMemberAnalyticsFilters({ activity: 'never' }), 'Asia/Kolkata', WEEK).sql;
    expect(never).toContain('m.last_active_at IS NULL');
    const inactive = buildMemberAnalyticsQuery(parseMemberAnalyticsFilters({ activity: 'inactive_30d' }), 'Asia/Kolkata', WEEK).sql;
    expect(inactive).toContain("m.last_active_at < now() - interval '30 days'");
  });

  it('missing weekly report only counts members who have a course', () => {
    const { sql } = buildMemberAnalyticsQuery(parseMemberAnalyticsFilters({ weeklyReport: 'missing' }), 'Asia/Kolkata', WEEK);
    expect(sql).toMatch(/NOT EXISTS \(SELECT 1 FROM course_weekly_feedback[\s\S]*EXISTS \(SELECT 1 FROM course_enrollments ce3/);
  });

  it('sorts never-active members last when sorting by last active', () => {
    const { sql } = buildMemberAnalyticsQuery(parseMemberAnalyticsFilters({}), 'Asia/Kolkata', WEEK);
    expect(sql).toContain('ORDER BY last_active_at DESC NULLS LAST');
  });
});

describe('buildMemberAnalyticsCountQuery', () => {
  it('counts with the same filters and no paging', () => {
    const f = parseMemberAnalyticsFilters({ search: 'ravi', status: 'active', page: '4' });
    const { sql, params } = buildMemberAnalyticsCountQuery(f, 'Asia/Kolkata', WEEK);
    expect(sql).toMatch(/^SELECT COUNT\(\*\)::int AS total FROM \(/);
    expect(sql).not.toMatch(/LIMIT|OFFSET|ORDER BY/);
    const max = Math.max(...[...sql.matchAll(/\$(\d+)/g)].map((m) => Number(m[1])));
    expect(max).toBe(params.length);
    expect(params).toContain('%ravi%');
  });
});
