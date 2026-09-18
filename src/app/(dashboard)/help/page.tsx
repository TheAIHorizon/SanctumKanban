import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { ArrowRight, BookOpen } from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { getHelpGuidesForRole } from '@/lib/help-content'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function HelpIndexPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login?callbackUrl=%2Fhelp')

  const guides = getHelpGuidesForRole(session.user.role)

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-1 py-2 sm:px-4">
      <header className="space-y-3">
        <div className="flex items-center gap-2 text-primary">
          <BookOpen className="h-5 w-5" aria-hidden="true" />
          <span className="text-sm font-medium">Sanctum Kanban guides</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Help</h1>
        <p className="max-w-3xl text-muted-foreground">
          Practical guidance for the features and permissions available to your account.
          Guides are rendered inside the application and filtered for your current role.
        </p>
      </header>

      <section aria-labelledby="guide-list-heading" className="space-y-4">
        <h2 id="guide-list-heading" className="text-xl font-semibold">Available guides</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {guides.map((guide) => (
            <Card key={guide.slug} className="flex h-full flex-col transition-colors hover:bg-muted/30">
              <CardHeader className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-lg">{guide.title}</CardTitle>
                  {guide.audience === 'admin' && <Badge variant="secondary">ADMIN</Badge>}
                </div>
                <CardDescription className="text-sm leading-relaxed">
                  {guide.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <Link
                  href={`/help/${guide.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  Read guide
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
