import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { parseRoster } from '@/lib/student-roster'
import { importRoster, rosterPlan, RosterError } from '@/lib/student-roster.server'
import { isTransactionConflict } from '@/lib/transaction-conflicts'
// Never emit roster rows or credential-bearing Prisma errors into logs.
const globalState = globalThis as unknown as { rosterPrisma?: PrismaClient }
const db = globalState.rosterPrisma || new PrismaClient({ log: [] })
if (process.env.NODE_ENV !== 'production') globalState.rosterPrisma = db
const input = z.object({ action: z.enum(['preview', 'import']), csv: z.string().max(100000), individualBoards: z.boolean().default(false), previewHash: z.string().regex(/^[a-f0-9]{64}$/).optional() })
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Only instructors can import students.' }, { status: 403 })
  const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
  try {
    const reader = request.body?.getReader(); if (!reader) return reply({ error: 'A CSV roster is required.' }, 400)
    const chunks: Uint8Array[] = []; let size = 0
    while (true) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > 200000) { await reader.cancel(); return reply({ error: 'The upload is too large. Use at most 100 students.' }, 413) } chunks.push(value) }
    const parsed = input.safeParse(JSON.parse(Buffer.concat(chunks).toString('utf8')))
    if (!parsed.success) return reply({ error: 'Provide a CSV roster and preview it before importing.' }, 400)
    const body = parsed.data
    let rows
    try { rows = parseRoster(body.csv) } catch (e) { return reply({ error: (e as Error).message }, 400) }
    if (body.action === 'preview') return reply(await rosterPlan(db, params.id, rows, body.individualBoards))
    if (!body.previewHash) return reply({ error: 'Preview the roster before importing.' }, 400)
    return reply(await importRoster(db, params.id, body.csv, body.previewHash, body.individualBoards))
  } catch (error) {
    if (error instanceof RosterError) return reply({ error: error.message }, error.status)
    if (isTransactionConflict(error) || (error as { code?: string })?.code === 'P2002') return reply({ error: 'Accounts or enrollment changed during the import. No partial import was saved. Preview again.' }, 409)
    return reply({ error: 'Import could not be completed. Preview again to check enrollment before retrying. Existing passwords are never reset.' }, 400)
  }
}
