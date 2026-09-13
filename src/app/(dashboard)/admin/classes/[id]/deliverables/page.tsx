import { DeliverablesDistributor } from '@/components/admin/DeliverablesDistributor'

export default function ClassDeliverablesPage({ params }: { params: { id: string } }) {
  return <DeliverablesDistributor classId={params.id} />
}
