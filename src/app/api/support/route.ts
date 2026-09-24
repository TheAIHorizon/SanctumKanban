import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, supportSelect } from '@/lib/support-prisma.server'
import { canUseSupport, createSupportPost, supportKind, supportStatus, supportWhere } from '@/lib/support-posts'
const headers = { 'Cache-Control': 'private, no-store' }
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Sign in to view submissions.' }, { status: 401 })
  if (!canUseSupport(session.user.role)) return NextResponse.json({ error: 'Submissions are unavailable for observers.' }, { status: 403 })
  const q = request.nextUrl.searchParams, page = Number(q.get('page') || 1)
  const kind = q.get('kind'), status = q.get('status')
  if (!Number.isInteger(page) || page < 1 || page > 10000 || (kind && !supportKind.safeParse(kind).success) || (status && !supportStatus.safeParse(status).success)) return NextResponse.json({ error: 'Invalid filters.' }, { status: 400 })
  const where = { ...supportWhere(session.user), ...(kind ? { kind } : {}), ...(status ? { status } : {}) }
  const [posts, total] = await prisma.$transaction([
    prisma.supportPost.findMany({ where, select: supportSelect, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 25, skip: (page - 1) * 25 }),
    prisma.supportPost.count({ where }),
  ])
  return NextResponse.json({ posts, total, page }, { headers })
}
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Sign in to submit a post.' }, { status: 401 })
  if (!canUseSupport(session.user.role)) return NextResponse.json({ error: 'Observers cannot submit posts.' }, { status: 403 })
  const parsed = createSupportPost.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Enter a title (3–160 characters), description (10–10,000 characters), and valid post type. Steps are limited to 5,000 characters.' }, { status: 400 })
  try {
    const post = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`support:${session.user.id}`}))`
      const recent = await tx.supportPost.count({ where: { authorId: session.user.id, createdAt: { gte: new Date(Date.now() - 86400000) } } })
      if (recent >= 20) return null
      return tx.supportPost.create({ data: { ...parsed.data, authorId: session.user.id }, select: supportSelect })
    })
    if (!post) return NextResponse.json({ error: 'You can submit up to 20 posts per 24 hours. Please try again later.' }, { status: 429 })
    return NextResponse.json(post, { status: 201, headers })
  } catch { return NextResponse.json({ error: 'Could not save your post. Please try again.' }, { status: 503 }) }
}
