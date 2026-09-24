import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Assessments } from '@/components/assessments/Assessments'
export default async function AssessmentPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  if (session.user.role === 'OBSERVER') redirect('/')
  const staff = session.user.role === 'ADMIN'
  const classes = await prisma.classWorkspace.findMany({ where: staff ? {} : { members: { some: { userId: session.user.id } } }, orderBy: { name: 'asc' }, select: { id: true, name: true, archivedAt: true, members: { where: staff ? { user: { role: { not: 'OBSERVER' } } } : { userId: session.user.id }, select: { user: { select: { id: true, firstName: true, lastName: true } } } } } })
  return <Assessments staff={staff} userId={session.user.id} classes={classes.map(c => ({ id: c.id, name: c.name, archived: !!c.archivedAt, students: c.members.map(m => ({ id: m.user.id, name: `${m.user.firstName} ${m.user.lastName}` })) }))} />
}
