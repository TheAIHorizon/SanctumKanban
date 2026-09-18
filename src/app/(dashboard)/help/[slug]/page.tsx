import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { getHelpGuideForRole } from '@/lib/help-content'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface HelpGuidePageProps {
  params: { slug: string }
}

export default async function HelpGuidePage({ params }: HelpGuidePageProps) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    const callbackUrl = encodeURIComponent(`/help/${params.slug}`)
    redirect(`/login?callbackUrl=${callbackUrl}`)
  }

  const guide = getHelpGuideForRole(params.slug, session.user.role)
  if (!guide) notFound()

  return (
    <article className="mx-auto w-full max-w-4xl space-y-8 px-1 py-2 sm:px-4">
      <Button asChild variant="ghost" size="sm" className="-ml-3 w-fit">
        <Link href="/help">
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
          All help guides
        </Link>
      </Button>

      <header className="space-y-3 border-b pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-primary">Help guide</span>
          {guide.audience === 'admin' && <Badge variant="secondary">ADMIN only</Badge>}
        </div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{guide.title}</h1>
        <p className="max-w-3xl text-lg leading-relaxed text-muted-foreground">
          {guide.description}
        </p>
      </header>

      <div className="space-y-5">
        {guide.sections.map((section) => (
          <Card key={section.heading}>
            <CardHeader>
              <CardTitle className="text-xl">{section.heading}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-7 sm:text-base">
              {section.blocks.map((block, blockIndex) =>
                block.type === 'paragraph' ? (
                  <p key={blockIndex} className="text-foreground/90">{block.text}</p>
                ) : (
                  <ul key={blockIndex} className="list-disc space-y-2 pl-6 text-foreground/90">
                    {block.items.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                )
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <nav aria-label="Help guide navigation" className="border-t pt-6">
        <Link
          href="/help"
          className="inline-flex items-center gap-2 rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to all help guides
        </Link>
      </nav>
    </article>
  )
}
