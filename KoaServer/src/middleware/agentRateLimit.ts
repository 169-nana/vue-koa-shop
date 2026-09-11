import type { AppMiddleware } from '../types'

import { fail } from '../utils/response'

const WINDOW_MS = 60_000
const MAX_REQUESTS = 12
const MAX_EVENT_REQUESTS = 60
const MAX_ACTION_REQUESTS = 20

interface RateLimitEntry {
  count: number
  resetAt: number
}

const entries = new Map<string, RateLimitEntry>()

export interface RateLimitDecision {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

export function checkAgentRateLimit(
  key: string,
  now = Date.now(),
  maxRequests = MAX_REQUESTS
): RateLimitDecision {
  const current = entries.get(key)
  const entry = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + WINDOW_MS }
    : current

  entry.count += 1
  entries.set(key, entry)

  if (entries.size > 10_000) {
    for (const [storedKey, storedEntry] of entries) {
      if (storedEntry.resetAt <= now) entries.delete(storedKey)
    }
  }

  return {
    allowed: entry.count <= maxRequests,
    remaining: Math.max(0, maxRequests - entry.count),
    retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000))
  }
}

const agentRateLimit: AppMiddleware = async (ctx, next) => {
  const key = ctx.state.user
    ? `user:${ctx.state.user.id}`
    : `ip:${ctx.ip}`
  const decision = checkAgentRateLimit(key)

  ctx.set('X-RateLimit-Limit', String(MAX_REQUESTS))
  ctx.set('X-RateLimit-Remaining', String(decision.remaining))

  if (!decision.allowed) {
    ctx.status = 429
    ctx.set('Retry-After', String(decision.retryAfterSeconds))
    ctx.body = fail(`请求过于频繁，请在${decision.retryAfterSeconds}秒后重试`)
    return
  }

  await next()
}

export default agentRateLimit

export const agentEventRateLimit: AppMiddleware = async (ctx, next) => {
  const identity = ctx.state.user
    ? `user:${ctx.state.user.id}`
    : `ip:${ctx.ip}`
  const decision = checkAgentRateLimit(`event:${identity}`, Date.now(), MAX_EVENT_REQUESTS)
  if (!decision.allowed) {
    ctx.status = 429
    ctx.body = fail('行为记录请求过于频繁')
    return
  }
  await next()
}

export const agentActionRateLimit: AppMiddleware = async (ctx, next) => {
  const identity = ctx.state.user
    ? `user:${ctx.state.user.id}`
    : `ip:${ctx.ip}`
  const decision = checkAgentRateLimit(`action:${identity}`, Date.now(), MAX_ACTION_REQUESTS)
  if (!decision.allowed) {
    ctx.status = 429
    ctx.body = fail('确认操作过于频繁，请稍后重试')
    return
  }
  await next()
}
