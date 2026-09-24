import { PrismaClient } from '@prisma/client'
import { runAssessmentJob } from '../src/lib/assessment-worker.server'
if (process.env.ASSESSMENT_RUNNER !== '1' || !process.env.DATABASE_URL) throw new Error('Explicit ASSESSMENT_RUNNER=1 and DATABASE_URL are required.')
const db = new PrismaClient({ log: [] })
let stopping = false
process.on('SIGTERM', () => { stopping = true })
process.on('SIGINT', () => { stopping = true })
async function main() {
  while (!stopping) {
    try { await runAssessmentJob(db) } catch { process.stderr.write('Assessment worker could not poll; retrying.\n') }
    if (process.argv.includes('--once')) break
    if (!stopping) await new Promise(resolve => setTimeout(resolve, 5000))
  }
}
main().catch(() => { process.exitCode = 1 }).finally(() => db.$disconnect())
