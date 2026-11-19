import 'server-only'
import Anthropic from '@anthropic-ai/sdk'

/**
 * One Anthropic client per agent, each with its own key.
 *
 * Give each key its own workspace in the Anthropic Console, with a monthly
 * spend limit. Rate limits apply per organisation and model, and spend
 * limits apply per workspace. Separate keys mean a flood on the public
 * search bar hits the public workspace's ceiling, and the signed-in
 * assistant keeps working.
 *
 * In production a missing key is an error, not a fallback to a shared key.
 * In development, ANTHROPIC_API_KEY stands in for both.
 */

type Agent = 'public' | 'assistant'

// The first name is the documented one. The second is what production
// actually uses: Vercel won't rename a saved secret, and re-creating the
// keys to fix a name isn't worth it. LIGHTWEIGHT = public search (Haiku).
const ENV: Record<Agent, string[]> = {
  public: ['ANTHROPIC_API_KEY_PUBLIC', 'LIGHTWEIGHT_AGENT_CIRCLES'],
  assistant: ['ANTHROPIC_API_KEY_ASSISTANT', 'ASSISTANT_AGENT_CIRCLES'],
}

const keyFor = (agent: Agent) => ENV[agent].map((n) => process.env[n]).find(Boolean)

const clients: Partial<Record<Agent, Anthropic>> = {}

export function aiConfigured(agent: Agent) {
  return Boolean(keyFor(agent) || (process.env.NODE_ENV !== 'production' && process.env.ANTHROPIC_API_KEY))
}

export function anthropicFor(agent: Agent): Anthropic {
  const existing = clients[agent]
  if (existing) return existing
  const key = keyFor(agent) ?? (process.env.NODE_ENV !== 'production' ? process.env.ANTHROPIC_API_KEY : undefined)
  if (!key) throw new Error(`${ENV[agent][0]} is not set`)
  // Short timeout and one retry: a person is waiting on the other end.
  const client = new Anthropic({ apiKey: key, timeout: 30_000, maxRetries: 1 })
  clients[agent] = client
  return client
}
