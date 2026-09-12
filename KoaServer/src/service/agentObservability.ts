import { createHash } from 'node:crypto'

import config from '../config'
import db from '../db'

export interface AgentCallLogInput {
  userId?: number
  requestKey: string
  success: boolean
  durationMs: number
  promptChars: number
  responseChars: number
  requestId: string
  promptVersionId: number | null
  toolCalls: number
  toolNames: string[]
  recommendedProducts: number
  errorCode?: string
}

export interface AgentConversionInput {
  userId?: number
  requestKey: string
  eventType: 'product_click' | 'action_prepared' | 'add_to_cart'
  goodsId?: number
  actionId?: string
}

export function hashAgentRequestKey(value: string): string {
  return createHash('sha256')
    .update(`${config.jwtSecret}:${value}`)
    .digest('hex')
}

export async function recordAgentCall(input: AgentCallLogInput): Promise<void> {
  try {
    await db.execute(
      `
        INSERT INTO vueshop_agent_call_log (
          user_id,
          request_id,
          request_key_hash,
          model,
          prompt_version_id,
          success,
          duration_ms,
          prompt_chars,
          response_chars,
          tool_calls,
          tool_names,
          recommended_products,
          error_code
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        input.userId ?? null,
        input.requestId,
        hashAgentRequestKey(input.requestKey),
        config.deepseek.model,
        input.promptVersionId,
        input.success ? 1 : 0,
        Math.max(0, Math.round(input.durationMs)),
        Math.max(0, input.promptChars),
        Math.max(0, input.responseChars),
        Math.max(0, input.toolCalls),
        JSON.stringify(input.toolNames),
        Math.max(0, input.recommendedProducts),
        input.errorCode ?? ''
      ]
    )
  } catch (error: unknown) {
    console.warn(
      'Agent call log unavailable:',
      error instanceof Error ? error.message : 'Unknown error'
    )
  }
}

export async function recordAgentConversion(input: AgentConversionInput): Promise<void> {
  try {
    await db.execute(
      `
        INSERT INTO vueshop_agent_conversion_event (
          user_id, request_key_hash, event_type, goods_id, action_id
        ) VALUES (?, ?, ?, ?, ?)
      `,
      [
        input.userId ?? null,
        hashAgentRequestKey(input.requestKey),
        input.eventType,
        input.goodsId ?? null,
        input.actionId ?? null
      ]
    )
  } catch (error: unknown) {
    console.warn(
      'Agent conversion log unavailable:',
      error instanceof Error ? error.message : 'Unknown error'
    )
  }
}
