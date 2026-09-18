import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { REQUIRED_SCHEMA } from '../scripts/database-check.mjs'

test('read-only system check requires saved guidance, feedback and scheduling schema', () => {
  assert.ok(Object.hasOwn(REQUIRED_SCHEMA, 'TicketAiGuidance'))
  assert.ok(Object.hasOwn(REQUIRED_SCHEMA, 'InstructorFeedback'))
  assert.ok(REQUIRED_SCHEMA.ClassWorkspace.includes('nightlyReviewEnabled'))
})

test('nightly runner ships in the image and is opt-in without starting another web listener', () => {
  const docker = readFileSync('Dockerfile', 'utf8')
  const compose = readFileSync('docker-compose.yml', 'utf8')
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
  assert.equal(pkg.scripts['review:nightly'], 'tsx scripts/nightly-ticket-review.ts')
  assert.match(docker, /COPY --from=builder \/app\/scripts\/database-check\.mjs \.\/scripts\/database-check\.mjs/)
  assert.match(docker, /COPY --from=builder \/app\/scripts\/nightly-ticket-review\.ts \.\/scripts\/nightly-ticket-review\.ts/)
  assert.doesNotMatch(docker, /COPY --from=builder \/app\/scripts \.\/scripts/)
  assert.doesNotMatch(docker, /help-browser-check/)
  assert.match(docker, /COPY --from=builder \/app\/src\/lib \.\/src\/lib/)
  assert.match(docker, /COPY --from=builder \/app\/tsconfig.json \.\/tsconfig.json/)
  assert.match(compose, /profiles: \["nightly"\]/)
  assert.match(compose, /NIGHTLY_REVIEW_RUNNER: "1"/)
  const reviewer = compose.slice(compose.indexOf('  reviewer:'))
  assert.doesNotMatch(reviewer, /ports:/)
  const dockerignore = readFileSync('.dockerignore', 'utf8')
  assert.match(dockerignore, /\.ops\//)
  assert.match(dockerignore, /^docs\/$/m)
  assert.match(readFileSync('scripts/nightly-ticket-review.ts', 'utf8'), /new PrismaClient\(\{ log: \[\] \}\)/)
})
