import { TeamCoverage } from '@/components/reports/TeamCoverage'

export default function TeamCoveragePage({ params }: { params: { teamId: string } }) {
  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <TeamCoverage teamId={params.teamId} />
    </div>
  )
}
