/**
 * Provider-agnostic AI client (OpenAI-compatible chat completions).
 *
 * Part of the Sanctum Suite, which favors LOCAL AI. Configure via env so the
 * same code points at any OpenAI-compatible endpoint:
 *   - Ollama:     AI_BASE_URL=http://localhost:11434/v1   AI_MODEL=qwen3.8:27b
 *   - OpenWebUI:  AI_BASE_URL=http://<host>/api            AI_MODEL=<served-model>
 *   - Hosted:     AI_BASE_URL=https://api.openai.com/v1    AI_MODEL=gpt-4o-mini  AI_API_KEY=sk-...
 *
 * Defaults to local Ollama. AI features degrade gracefully when unreachable.
 */

const AI_BASE_URL = process.env.AI_BASE_URL || 'http://localhost:11434/v1'
const AI_MODEL = process.env.AI_MODEL || 'qwen3.8:27b'
const AI_API_KEY = process.env.AI_API_KEY || ''
const AI_TIMEOUT_MS = parseInt(process.env.AI_TIMEOUT_MS || '90000', 10)

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export class AiUnavailableError extends Error {}

/**
 * Call an OpenAI-compatible /chat/completions endpoint and return the text.
 * Throws AiUnavailableError on network/timeout/HTTP error so callers can fall back.
 */
export async function chat(
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number; json?: boolean } = {}
): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)
  try {
    const res = await fetch(`${AI_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(AI_API_KEY ? { Authorization: `Bearer ${AI_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages,
        temperature: opts.temperature ?? 0.2,
        max_tokens: opts.maxTokens ?? 512,
        stream: false,
        ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
      }),
    })
    if (!res.ok) {
      throw new AiUnavailableError(`AI endpoint returned ${res.status}`)
    }
    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content
    if (typeof content !== 'string') {
      throw new AiUnavailableError('AI response missing content')
    }
    return content
  } catch (err: any) {
    if (err instanceof AiUnavailableError) throw err
    throw new AiUnavailableError(err?.message || 'AI request failed')
  } finally {
    clearTimeout(timer)
  }
}

export function aiConfig() {
  return { baseUrl: AI_BASE_URL, model: AI_MODEL, hasKey: Boolean(AI_API_KEY) }
}
