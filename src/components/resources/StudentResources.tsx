import { ExternalLink, Link2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  RESOURCE_DEFINITIONS,
  type ResourceKey,
  validateResourceUrl,
} from '@/lib/student-resources'

interface StudentResourcesProps {
  resources: { key: string; url: string }[]
}

export function StudentResources({ resources }: StudentResourcesProps) {
  const byKey = new Map(resources.map((resource) => [resource.key, resource.url]))
  const configured = RESOURCE_DEFINITIONS.flatMap(({ key, label }) => {
    const url = byKey.get(key)
    return url && validateResourceUrl(url) ? [{ key: key as ResourceKey, label, url }] : []
  })

  if (!configured.length) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Link2 className="h-5 w-5" />Student Resources
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {configured.map(({ key, label, url }) => (
          <a
            key={key}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            {label}<ExternalLink className="h-3.5 w-3.5" />
          </a>
        ))}
      </CardContent>
    </Card>
  )
}
