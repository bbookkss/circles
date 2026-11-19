/**
 * Every limit on the two agents, in one place. Each can be overridden by an
 * env var, so a flood can be answered by tightening a number in Vercel
 * without a deploy.
 *
 * These protect two things: the bill, and the Anthropic rate limit that
 * signed-in users depend on. The hard backstop is the separate spend limit
 * on each agent's Anthropic workspace (see docs/agents/README.md). These
 * numbers make it rare to reach that backstop.
 */

const n = (name: string, fallback: number) => {
  const v = Number(process.env[name])
  return Number.isFinite(v) && v > 0 ? v : fallback
}

export const HOUR = 3600
export const DAY = 86400

export const PUBLIC = {
  model: 'claude-haiku-5-5',
  maxInputChars: 120,
  perIpPerHour: n('AI_PUBLIC_PER_IP_HOUR', 10),
  perIpPerDay: n('AI_PUBLIC_PER_IP_DAY', 30),
  // Across every visitor. When it trips, the bar says to sign up instead.
  globalPerDay: n('AI_PUBLIC_GLOBAL_DAY', 5000),
  globalTokensPerDay: n('AI_PUBLIC_GLOBAL_TOKENS_DAY', 20_000_000),
  maxTokens: 400,
  maxModelCalls: 3,
  maxResults: 5,
} as const

export const ASSISTANT = {
  model: 'claude-sonnet-5-5',
  maxInputChars: 500,
  perUserPerHour: n('AI_ASSISTANT_PER_USER_HOUR', 30),
  perUserPerDay: n('AI_ASSISTANT_PER_USER_DAY', 120),
  userTokensPerDay: n('AI_ASSISTANT_USER_TOKENS_DAY', 400_000),
  globalPerDay: n('AI_ASSISTANT_GLOBAL_DAY', 20000),
  globalTokensPerDay: n('AI_ASSISTANT_GLOBAL_TOKENS_DAY', 60_000_000),
  maxTokens: 1200,
  maxModelCalls: 5,
  // Conversation history sent back to the model: the last few turns only.
  maxHistoryTurns: 8,
  maxHistoryChars: 6000,
} as const
