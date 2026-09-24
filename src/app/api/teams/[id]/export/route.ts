import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canReadTeamNote } from '@/lib/team-notes'
import { parseExportOptions, renderTeamExport } from '@/lib/team-export'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let options
  try { options = parseExportOptions(request.nextUrl.searchParams) }
  catch (err) { return NextResponse.json({ error: (err as Error).message }, { status: 400 }) }
  const team = await prisma.team.findUnique({ where: { id: params.id }, select: {
    name: true, members: { select: { userId: true } },
    classWorkspace: { select: { name: true, members: { select: { userId: true } } } },
  } })
  if (!team || !canReadTeamNote(session.user, { hasClass: !!team.classWorkspace, classMemberUserIds: team.classWorkspace?.members.map(m => m.userId) || [], teamMemberUserIds: team.members.map(m => m.userId) })) return NextResponse.json({ error: 'Team unavailable' }, { status: 404 })
  const tickets = await prisma.ticket.findMany({ where: { teamId: params.id, archived: false }, orderBy: [{ status: 'asc' }, { position: 'asc' }], select: {
    id: true, title: true, description: true, status: true, startDate: true, dueDate: true, startedAt: true, completedAt: true, startDateAutoFilled: true, createdAt: true, updatedAt: true, assignee: { select: { firstName: true, lastName: true } },
  } })
  return new NextResponse(renderTeamExport({ name: team.name, className: team.classWorkspace?.name || 'Team board', tickets }, options), { headers: {
    'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store',
    'Content-Disposition': `${request.nextUrl.searchParams.get('download') === '1' ? 'attachment' : 'inline'}; filename="team-${options.view}-${options.from}.html"`,
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    'X-Content-Type-Options': 'nosniff',
  } })
}
