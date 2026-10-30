import type { FastifyReply, FastifyRequest } from 'fastify';

/** The subset of PrismaClient / a transaction client these handlers use. */
export interface Db {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
}

export const rows = <T = Record<string, any>>(db: Db, sql: string, ...params: unknown[]) => db.$queryRawUnsafe<T[]>(sql, ...params);

/** JSON for a `$n::jsonb` parameter (null stays SQL NULL). */
export const jsonParam = (v: unknown) => (v === undefined || v === null ? null : JSON.stringify(v));

/** Postgres SQLSTATE of a failed raw query (Prisma wraps it), e.g. '23505' for a unique violation. */
export function pgCode(err: unknown): string | undefined {
  const e = err as { meta?: { code?: string }; code?: string; message?: string };
  return e?.meta?.code ?? (String(e?.message ?? '').match(/Code: `(\w+)`/)?.[1]) ?? (/^\d{5}$/.test(String(e?.code)) ? e.code : undefined);
}

export const isUniqueViolation = (err: unknown) => pgCode(err) === '23505';

/** The acting TBT admin, set by the module's preHandler. */
export interface PsyAdmin {
  id: string;
  fullName: string;
  email: string;
  role: string;
}
export const actingAdmin = (req: FastifyRequest) => (req as FastifyRequest & { psyAdmin: PsyAdmin }).psyAdmin;

export const fail = (reply: FastifyReply, status: number, message: string, extra: Record<string, unknown> = {}) =>
  reply.code(status).send({ success: false, message, ...extra });
