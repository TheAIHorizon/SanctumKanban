import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(path, 'utf8')

test('help index is a server route that revalidates the session and filters by role', () => {
  const source = read('src/app/(dashboard)/help/page.tsx')
  assert.doesNotMatch(source, /['"]use client['"]/)
  assert.match(source, /getServerSession\(authOptions\)/)
  assert.match(source, /redirect\(['"`]\/login\?callbackUrl=/)
  assert.match(source, /getHelpGuidesForRole\(session\.user\.role\)/)
  assert.match(source, /<h1[^>]*>Help/)
  assert.match(source, /href=\{`\/help\/\$\{guide\.slug\}`\}/)
})

test('help detail is a server route with strict lookup and server-side denial', () => {
  const source = read('src/app/(dashboard)/help/[slug]/page.tsx')
  assert.doesNotMatch(source, /['"]use client['"]/)
  assert.match(source, /getServerSession\(authOptions\)/)
  assert.match(source, /callbackUrl=/)
  assert.match(source, /getHelpGuideForRole\(params\.slug, session\.user\.role\)/)
  assert.match(source, /if \(!guide\) notFound\(\)/)
  assert.match(source, /href="\/help"/)
  assert.match(source, /<h1/)
})

test('help pages render typed content as React nodes and never load raw documents', () => {
  const sources = [
    read('src/app/(dashboard)/help/page.tsx'),
    read('src/app/(dashboard)/help/[slug]/page.tsx'),
    read('src/lib/help-content.ts'),
  ].join('\n')
  assert.doesNotMatch(sources, /from ['"]node:fs['"]|require\(['"]fs['"]\)|readFile|createReadStream/)
  assert.doesNotMatch(sources, /dangerouslySetInnerHTML|<iframe|\.html\b|\/docs\//)
  assert.doesNotMatch(sources, /process\.cwd|__dirname|public\//)
  assert.match(sources, /block\.type === 'paragraph'/)
  assert.match(sources, /block\.items\.map/)
})

test('header exposes a mobile-reachable Help button beside the theme control without nesting links', () => {
  const source = read('src/components/layout/Header.tsx')
  assert.match(source, /HelpCircle/)
  assert.match(source, /<Button[^>]*asChild[^>]*>/)
  assert.match(source, /<Link href="\/help"/)
  assert.match(source, /<ThemeToggle \/>/)
  assert.match(source, /min-w-0/)
  assert.match(source, /overflow-x-auto/)
})

test('middleware protects every help path', () => {
  const source = read('src/middleware.ts')
  assert.match(source, /['"]\/help\/:path\*['"]/)
})
