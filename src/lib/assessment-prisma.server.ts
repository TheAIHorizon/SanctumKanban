import { PrismaClient } from '@prisma/client'
// Keep assessment evidence and answer keys out of Prisma query/error logs.
const globalState = globalThis as unknown as { assessmentPrisma?: PrismaClient }
export const prisma = globalState.assessmentPrisma || new PrismaClient({ log: [] })
if (process.env.NODE_ENV !== 'production') globalState.assessmentPrisma = prisma
