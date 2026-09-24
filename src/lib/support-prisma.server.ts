import { PrismaClient } from '@prisma/client'
// Reports may contain sensitive details. Do not log queries or report bodies.
const state = globalThis as unknown as { supportPrisma?: PrismaClient }
export const prisma = state.supportPrisma || new PrismaClient({ log: [] })
if (process.env.NODE_ENV !== 'production') state.supportPrisma = prisma
export const supportSelect = { id: true, kind: true, title: true, description: true, steps: true, status: true, staffReply: true, createdAt: true, updatedAt: true, author: { select: { firstName: true, lastName: true } } } as const
