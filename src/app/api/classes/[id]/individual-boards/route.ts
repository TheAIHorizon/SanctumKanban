import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { individualBoardPlan, createClassIndividualBoards, IndividualBoardError } from '@/lib/individual-boards.server'
import { isTransactionConflict } from '@/lib/transaction-conflicts'
const input = z.object({ action: z.enum(['preview', 'create']), previewHash: z.string().regex(/^[a-f0-9]{64}$/).optional() })
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Only instructors can create individual boards.' }, { status: 403 })
  const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
  try {
    // No roster or other large input is accepted on this endpoint.
    const reader = request.body?.getReader()
    if (!reader) return reply({ error: 'Preview the students first.' }, 400)
    const chunks: Uint8Array[] = []; let size = 0
    while (true) {
      const { done, value } = await reader.read(); if (done) break
      size += value.byteLength
      if (size > 1024) { await reader.cancel(); return reply({ error: 'Request too large.' }, 413) }
      chunks.push(value)
    }
    const body = input.safeParse(JSON.parse(Buffer.concat(chunks).toString('utf8')))
    if (!body.success) return reply({ error: 'Preview the students first.' }, 400)
    if (body.data.action === 'preview') return reply(await individualBoardPlan(prisma, params.id))
    if (!body.data.previewHash) return reply({ error: 'Preview the students first.' }, 400)
    return reply(await createClassIndividualBoards(prisma, params.id, body.data.previewHash))
  } catch (error) {
    if (error instanceof IndividualBoardError) return reply({ error: error.message }, error.status)
    if (isTransactionConflict(error) || (error as { code?: string })?.code === 'P2002') return reply({ error: 'Enrollment or boards changed. Preview again; no partial changes were saved.' }, 409)
    return reply({ error: 'Could not create boards. Preview again to check the current boards before retrying.' }, 400)
  }
}
