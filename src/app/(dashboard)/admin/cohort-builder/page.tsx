import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { CohortBuilder } from '@/components/cohort/CohortBuilder'

export default async function CohortBuilderPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    redirect('/')
  }
  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <CohortBuilder />
    </div>
  )
}
