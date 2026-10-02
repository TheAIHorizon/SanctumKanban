import { Prisma, PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

export const BootstrapAdminInput = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  password: z.string().min(12).refine(value => Buffer.byteLength(value, 'utf8') <= 72),
})

/** Host-operator bootstrap only. Never reset a password or promote an existing account. */
export async function bootstrapAdmin(db: PrismaClient, input: unknown) {
  const parsed = BootstrapAdminInput.safeParse(input)
  if (!parsed.success) throw new Error('Use a valid email, both names, and a password of at least 12 characters and at most 72 UTF-8 bytes.')
  const { password, ...identity } = parsed.data
  const passwordHash = await bcrypt.hash(password, 12)
  return db.$transaction(async tx => {
    if (await tx.user.count({ where: { role: 'ADMIN' } })) {
      throw new Error('An administrator already exists. Sign in and use Users to manage accounts.')
    }
    if (await tx.user.findFirst({ where: { email: { equals: identity.email, mode: 'insensitive' } }, select: { id: true } })) {
      throw new Error('That email already exists. No account was changed.')
    }
    return tx.user.create({
      data: { ...identity, passwordHash, role: 'ADMIN', color: '#2563eb' },
      select: { id: true },
    })
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}
