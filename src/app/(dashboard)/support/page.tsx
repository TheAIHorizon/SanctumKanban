import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { canUseSupport } from '@/lib/support-posts'
import { SupportPosts } from '@/components/support/SupportPosts'
export default async function SupportPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  if (!canUseSupport(session.user.role)) redirect('/')
  return <SupportPosts staff={session.user.role === 'ADMIN'} />
}
