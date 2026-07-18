import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Master-data (cities / states / business types) list + create.
 *
 * The three master tables share identical schema: `id`, `name`,
 * `created_at`, `updated_at`, plus a unique index on `lower(name)`
 * declared in the startup SQL (see `plugins/prisma.ts`). This module
 * exposes the same 4 handlers three times over — once per kind —
 * without duplicating the logic. A `MasterKind` discriminant picks
 * the right Prisma delegate at runtime.
 *
 * Normalization rules (applied to every write):
 *   * Trim leading/trailing whitespace.
 *   * Collapse internal whitespace to single spaces.
 *   * Title-case ("chennai" → "Chennai", "tamil NADU" → "Tamil Nadu").
 *     Keeps acronyms roughly right for the common Indian city/state
 *     cases; edge cases like "USA" degrade to "Usa" which the admin
 *     can rename manually.
 *   * Reject the empty string.
 *
 * The unique index on `lower(name)` enforces case-insensitive dedup
 * at the DB level regardless of what upstream code does — so even a
 * misbehaving client that skips the normalizer cannot introduce
 * "Chennai" / "chennai" as two separate rows.
 */

type MasterKind = 'cities' | 'states' | 'business-types';

// Map the URL segment to the Prisma delegate. Keeps the controllers
// generic — every handler operates on `delegateFor(kind)`.
function delegateFor(prisma: any, kind: MasterKind): any {
  switch (kind) {
    case 'cities': return prisma.city;
    case 'states': return prisma.state;
    case 'business-types': return prisma.businessType;
  }
}

function isMasterKind(v: any): v is MasterKind {
  return v === 'cities' || v === 'states' || v === 'business-types';
}

/**
 * Normalize a user-supplied name value into the canonical form
 * stored in the master table. Returns null if the input is empty
 * or all whitespace so callers can 400 instead of inserting an
 * empty row.
 */
export function normalizeMasterName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const collapsed = raw.replace(/\s+/g, ' ').trim();
  if (!collapsed) return null;
  // Title-case each word. Preserves apostrophes ("O'Neill") and
  // hyphens ("Coimbatore-South") reasonably. Downcases the rest.
  return collapsed
    .split(' ')
    .map((word) => {
      if (!word) return word;
      // Handle hyphenated segments as their own mini-title-cases.
      return word
        .split('-')
        .map((seg) => seg.charAt(0).toUpperCase() + seg.slice(1).toLowerCase())
        .join('-');
    })
    .join(' ');
}

export async function listMasterHandler(req: FastifyRequest, reply: FastifyReply) {
  const { kind } = req.params as { kind: string };
  if (!isMasterKind(kind)) {
    return reply.status(404).send({ success: false, data: null, error: 'Unknown master kind' });
  }
  const { q = '', limit = 200 } = req.query as any;
  const search = typeof q === 'string' ? q.trim() : '';
  const cap = Math.min(Number(limit) || 200, 500);

  const where = search
    // Case-insensitive contains — the lower(name) index makes this a
    // fast scan even with a large table.
    ? { name: { contains: search, mode: 'insensitive' as const } }
    : {};

  const rows = await delegateFor(req.server.prisma, kind).findMany({
    where,
    orderBy: { name: 'asc' },
    take: cap,
    select: { id: true, name: true },
  });

  return reply.send({ success: true, data: rows, meta: { total: rows.length }, error: null });
}

export async function createMasterHandler(req: FastifyRequest, reply: FastifyReply) {
  const { kind } = req.params as { kind: string };
  if (!isMasterKind(kind)) {
    return reply.status(404).send({ success: false, data: null, error: 'Unknown master kind' });
  }
  const body = req.body as { name?: unknown };
  const normalized = normalizeMasterName(body?.name);
  if (!normalized) {
    return reply.status(400).send({ success: false, data: null, error: 'Name is required' });
  }

  const delegate = delegateFor(req.server.prisma, kind);

  // Idempotent upsert — if a row with the same lower(name) already
  // exists we return it instead of throwing. Prisma can't express the
  // functional unique index directly, so we do a case-insensitive
  // find first, then create only if absent. The DB-level unique
  // constraint is our belt-and-suspenders backstop.
  const existing = await delegate.findFirst({
    where: { name: { equals: normalized, mode: 'insensitive' } },
    select: { id: true, name: true },
  });
  if (existing) {
    return reply.send({ success: true, data: existing, error: null });
  }
  try {
    const created = await delegate.create({
      data: { name: normalized },
      select: { id: true, name: true },
    });
    return reply.status(201).send({ success: true, data: created, error: null });
  } catch (err: any) {
    // A concurrent request may have inserted the same value between
    // the find and the create. Recover by re-fetching — the caller
    // still gets the canonical row, no error surfaces.
    if (err?.code === 'P2002' || String(err?.message ?? '').includes('duplicate')) {
      const raced = await delegate.findFirst({
        where: { name: { equals: normalized, mode: 'insensitive' } },
        select: { id: true, name: true },
      });
      if (raced) return reply.send({ success: true, data: raced, error: null });
    }
    throw err;
  }
}
