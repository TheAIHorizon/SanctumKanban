import { loadEnvConfig } from '@next/env'

async function main() {
  loadEnvConfig(process.cwd(), false, { info() {}, error() {} })
  const names = ['AI_MODEL', 'AI_COACH_MODEL', 'AI_ASSESSMENT_MODEL'] as const
  if (!process.env.AI_BASE_URL || names.some(name => !process.env[name]?.trim())) {
    throw new Error('Set AI_BASE_URL, AI_MODEL, AI_COACH_MODEL and AI_ASSESSMENT_MODEL explicitly. See docs/ai-setup.md.')
  }
  const { chat, AiUnavailableError } = await import('../src/lib/ai')
  const { parseAssessmentJson } = await import('../src/lib/assessments')
  console.log('Checking three model settings with synthetic prompts only. No database is read. Provider usage may be billed.')
  for (const name of names) {
    const start = Date.now()
    try {
      const response = await chat([
        { role: 'system', content: 'Return JSON only. Never use markdown code fences.' },
        { role: 'user', content: 'Synthetic connection check. Return exactly {"ok":true}.' },
      ], {
        model: process.env[name], json: true, maxTokens: 4000, temperature: 0.8,
        timeoutMs: name === 'AI_ASSESSMENT_MODEL' ? 180_000 : 45_000,
        background: name === 'AI_ASSESSMENT_MODEL', requireComplete: true,
      })
      const value = parseAssessmentJson(response)
      if (!value || typeof value !== 'object' || !('ok' in value) || value.ok !== true) throw new Error('invalid_json')
      console.log(`PASS ${name}: text/JSON response (${Math.round((Date.now() - start) / 1000)}s)`)
    } catch (error) {
      const detail = error instanceof AiUnavailableError ? `${error.code}${error.status ? ` HTTP ${error.status}` : ''}` : 'invalid_json'
      console.error(`FAIL ${name}: ${detail}. See docs/ai-setup.md troubleshooting.`)
      process.exitCode = 1
    }
  }
  console.log('This checks connectivity and simple JSON, not full assessment quality. Test a complete exam with invented work before enabling student use.')
}

main().catch(() => {
  console.error('Cannot run check. Set AI_BASE_URL and all three model settings in .env or the container environment; see docs/ai-setup.md.')
  process.exitCode = 1
})
