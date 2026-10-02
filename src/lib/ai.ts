/**
 * Provider-agnostic AI client (OpenAI-compatible chat completions).
 *
 * Part of the Sanctum Suite, which favors LOCAL AI. Configure via env so the
 * same code points at any OpenAI-compatible endpoint:
 *   - Ollama:     AI_BASE_URL=http://localhost:11434/v1   AI_MODEL=qwen3.8:27b
 *   - OpenWebUI:  AI_BASE_URL=http://<host>/api            AI_MODEL=<served-model>
 *   - Hosted providers/gateways: explicitly configured by the operator.
 * See docs/ai-setup.md for model overrides, keys and compatibility limits.
 *
 * Defaults to local Ollama. Coaching can fall back; assessments fail explicitly.
 * External endpoints receive feature input; keys must stay server-side.
 */

const AI_BASE_URL = process.env.AI_BASE_URL || 'http://localhost:11434/v1'
const AI_MODEL = process.env.AI_MODEL || 'qwen3.8:27b'
const AI_API_KEY = process.env.AI_API_KEY || ''
const AI_TIMEOUT_MS = parseInt(process.env.AI_TIMEOUT_MS || '90000', 10)

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type AiFailureCode = 'timeout' | 'network' | 'http' | 'invalid_response' | 'truncated' | 'unavailable'
export class AiUnavailableError extends Error {
  constructor(message: string, readonly code: AiFailureCode = 'unavailable', readonly status?: number) {
    super(message)
    this.name = 'AiUnavailableError'
  }
}

/**
 * Call an OpenAI-compatible /chat/completions endpoint and return the text.
 * Throws AiUnavailableError on network/timeout/HTTP error so callers can fall back.
 */
export async function chat(
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number; json?: boolean; model?: string; timeoutMs?: number; background?: boolean; requireComplete?: boolean } = {}
): Promise<string> {
  const controller = new AbortController()
  const timeoutMs = opts.timeoutMs == null
    ? AI_TIMEOUT_MS
    : Math.max(1, Math.min(opts.timeoutMs, opts.background ? 180_000 : 45_000))
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${AI_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(AI_API_KEY ? { Authorization: `Bearer ${AI_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        model: opts.model || AI_MODEL,
        messages,
        temperature: opts.temperature ?? 0.2,
        max_tokens: opts.maxTokens ?? 512,
        stream: false,
        ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
      }),
    })
    if (!res.ok) {
      throw new AiUnavailableError(`AI endpoint returned ${res.status}`, 'http', res.status)
    }
    let data
    try { data = await res.json() } catch (err) {
      if (controller.signal.aborted) throw err
      throw new AiUnavailableError('AI endpoint returned an invalid response', 'invalid_response')
    }
    if (opts.requireComplete && data?.choices?.[0]?.finish_reason === 'length') {
      throw new AiUnavailableError('AI response reached its output limit', 'truncated')
    }
    const content = data?.choices?.[0]?.message?.content
    if (typeof content !== 'string') {
      throw new AiUnavailableError('AI response missing content', 'invalid_response')
    }
    return content
  } catch (err) {
    if (err instanceof AiUnavailableError) throw err
    // Keep provider bodies, URLs and arbitrary network errors out of saved failures.
    throw new AiUnavailableError(controller.signal.aborted ? 'AI request timed out' : 'AI request failed', controller.signal.aborted ? 'timeout' : 'network')
  } finally {
    clearTimeout(timer)
  }
}

export function aiConfig() {
  return { baseUrl: AI_BASE_URL, model: AI_MODEL, hasKey: Boolean(AI_API_KEY) }
}
