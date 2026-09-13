type ErrorLike = {
  code?: unknown
  meta?: unknown
}

const POSTGRES_TRANSACTION_CONFLICTS = new Set(['40001', '40P01'])

/** Prisma's serializable-write conflict plus raw PostgreSQL serialization/deadlock codes. */
export function isTransactionConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const candidate = error as ErrorLike
  if (candidate.code === 'P2034') return true
  if (!candidate.meta || typeof candidate.meta !== 'object') return false
  const postgresCode = (candidate.meta as { code?: unknown }).code
  return typeof postgresCode === 'string' && POSTGRES_TRANSACTION_CONFLICTS.has(postgresCode)
}
