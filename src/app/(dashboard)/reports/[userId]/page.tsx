import { UserReport } from '@/components/reports/UserReport'

export default function UserReportPage({ params }: { params: { userId: string } }) {
  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <UserReport userId={params.userId} />
    </div>
  )
}
