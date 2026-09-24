import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, supportSelect } from '@/lib/support-prisma.server'
import { canUseSupport, supportWhere, updateSupportPost } from '@/lib/support-posts'
const headers = { 'Cache-Control': 'private, no-store' }
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canUseSupport(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const post = await prisma.supportPost.findFirst({ where: { id: params.id, ...supportWhere(session.user) }, select: supportSelect })
  return post ? NextResponse.json(post, { headers }) : NextResponse.json({ error: 'Post unavailable.' }, { status: 404 })
}
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Only staff can update status and responses.' }, { status: 403 })
  const parsed = updateSupportPost.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Choose a valid status and a response of at most 10,000 characters.' }, { status: 400 })
  try {
    const { status, staffReply, updatedAt } = parsed.data
    const post = await prisma.$transaction(async tx => {
      const changed = await tx.supportPost.updateMany({ where: { id: params.id, updatedAt: new Date(updatedAt) }, data: { status, staffReply } })
      return changed.count ? tx.supportPost.findUnique({ where: { id: params.id }, select: supportSelect }) : null
    })
    return post ? NextResponse.json(post, { headers }) : NextResponse.json({ error: 'This post changed or is unavailable. Refresh before saving again.' }, { status: 409 })
  } catch { return NextResponse.json({ error: 'Could not save your response. Please try again.' }, { status: 503 }) }
}
