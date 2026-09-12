import type { ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'

import type {
  ShopAgentMessage,
  ShopAgentActionResult,
  AgentFeedbackInput,
  ShopAgentReply,
  ShopAgentStreamEvent
} from '../../../shared/api'

import type { AppContext, AppMiddleware } from '../types'

import { parseAgentMessages } from '../agent/validation'
import { recordAgentCall, recordAgentConversion } from '../service/agentObservability'
import { executeAddToCart } from '../service/agentCartAction'
import { saveFeedback } from '../service/agentOperations'
import { runShopAgent } from '../service/shopAgent'
import { AppError, getBody } from '../utils/input'
import { requireUser } from '../utils/identity'
import { fail, success } from '../utils/response'

function parseMessages(ctx: AppContext): ShopAgentMessage[] | null {
  const body = getBody(ctx.request.body)
  return parseAgentMessages(body.messages)
}

function promptLength(messages: ShopAgentMessage[]): number {
  return messages.reduce((total, message) => total + message.content.length, 0)
}

function requestKey(ctx: AppContext): string {
  return ctx.state.user
    ? `user:${ctx.state.user.id}`
    : `ip:${ctx.ip}`
}

async function runAndRecord(
  ctx: AppContext,
  messages: ShopAgentMessage[],
  requestId: string,
  onDelta?: (content: string) => void,
  onReset?: () => void
): Promise<ShopAgentReply> {
  const startedAt = Date.now()

  try {
    const result = await runShopAgent(
      messages,
      ctx.state.user?.id,
      onDelta,
      onReset
    )
    const reply: ShopAgentReply = {
      message: result.message,
      products: result.products,
      request_id: requestId,
      ...(result.pending_action ? { pending_action: result.pending_action } : {})
    }
    await recordAgentCall({
      userId: ctx.state.user?.id,
      requestKey: requestKey(ctx),
      success: true,
      durationMs: Date.now() - startedAt,
      promptChars: promptLength(messages),
      responseChars: reply.message.length,
      requestId,
      promptVersionId: result.promptVersionId,
      toolCalls: result.toolCalls,
      toolNames: result.toolNames,
      recommendedProducts: result.products.length
    })
    return reply
  } catch (error: unknown) {
    await recordAgentCall({
      userId: ctx.state.user?.id,
      requestKey: requestKey(ctx),
      success: false,
      durationMs: Date.now() - startedAt,
      promptChars: promptLength(messages),
      responseChars: 0,
      requestId,
      promptVersionId: null,
      toolCalls: 0,
      toolNames: [],
      recommendedProducts: 0,
      errorCode: error instanceof AppError ? error.code : 'UNKNOWN_ERROR'
    })
    throw error
  }
}

export const chat: AppMiddleware<ShopAgentReply> = async ctx => {
  const messages = parseMessages(ctx)

  if (!messages) {
    ctx.body = fail('对话内容不正确，最多提交12条消息，且最后一条必须来自用户')
    return
  }

  try {
    ctx.body = success(await runAndRecord(ctx, messages, randomUUID()))
  } catch (error: unknown) {
    if (error instanceof AppError) {
      ctx.body = fail(error.message)
      return
    }
    throw error
  }
}

export const confirmAddToCart: AppMiddleware<ShopAgentActionResult> = async ctx => {
  const body = getBody(ctx.request.body)
  const token = typeof body.token === 'string' ? body.token.trim() : ''
  if (!token || token.length > 2000) {
    ctx.body = fail('确认凭证不正确')
    return
  }

  try {
    const result = await executeAddToCart(requireUser(ctx).id, token)
    ctx.body = success(result)
  } catch (error: unknown) {
    if (error instanceof AppError) {
      ctx.body = fail(error.message)
      return
    }
    throw error
  }
}

export const trackProductClick: AppMiddleware<null> = async ctx => {
  const goodsId = Number(getBody(ctx.request.body).goods_id)
  if (!Number.isInteger(goodsId) || goodsId <= 0) {
    ctx.body = fail('商品ID不正确')
    return
  }
  await recordAgentConversion({
    userId: ctx.state.user?.id,
    requestKey: requestKey(ctx),
    eventType: 'product_click',
    goodsId
  })
  ctx.body = success()
}

function parseFeedback(value: unknown): AgentFeedbackInput | null {
  const body = getBody(value)
  if (
    typeof body.request_id !== 'string' ||
    !/^[a-f0-9-]{36}$/i.test(body.request_id) ||
    (body.rating !== 'helpful' && body.rating !== 'unhelpful') ||
    (body.category !== undefined && (typeof body.category !== 'string' || body.category.length > 60)) ||
    (body.comment !== undefined && (typeof body.comment !== 'string' || body.comment.length > 500))
  ) return null
  return {
    request_id: body.request_id,
    rating: body.rating,
    ...(typeof body.category === 'string' ? { category: body.category.trim() } : {}),
    ...(typeof body.comment === 'string' ? { comment: body.comment.trim() } : {})
  }
}

export const feedback: AppMiddleware<null> = async ctx => {
  const input = parseFeedback(ctx.request.body)
  if (!input) { ctx.body = fail('反馈参数不正确'); return }
  try {
    await saveFeedback(input, ctx.state.user?.id, requestKey(ctx))
    ctx.body = success()
  } catch (error: unknown) {
    if (error instanceof AppError) { ctx.body = fail(error.message); return }
    throw error
  }
}

function writeEvent(response: ServerResponse, event: ShopAgentStreamEvent): void {
  if (!response.destroyed && !response.writableEnded) {
    response.write(`data: ${JSON.stringify(event)}\n\n`)
  }
}

function writeReply(response: ServerResponse, reply: ShopAgentReply): void {
  if (reply.products.length > 0) {
    writeEvent(response, { type: 'products', products: reply.products })
  }
  if (reply.pending_action) {
    writeEvent(response, { type: 'action', action: reply.pending_action })
  }
  writeEvent(response, { type: 'done' })
  response.end()
}

export const streamChat: AppMiddleware = async ctx => {
  const messages = parseMessages(ctx)

  if (!messages) {
    ctx.body = fail('对话内容不正确，最多提交12条消息，且最后一条必须来自用户')
    return
  }

  const response = ctx.res
  const requestId = randomUUID()
  ctx.respond = false
  response.statusCode = 200
  response.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  response.setHeader('Cache-Control', 'no-cache, no-transform')
  response.setHeader('Connection', 'keep-alive')
  response.setHeader('Access-Control-Allow-Origin', ctx.header.origin || '*')
  response.flushHeaders()
  writeEvent(response, { type: 'meta', request_id: requestId })

  void runAndRecord(
    ctx,
    messages,
    requestId,
    content => writeEvent(response, { type: 'delta', content }),
    () => writeEvent(response, { type: 'reset' })
  )
    .then(reply => writeReply(response, reply))
    .catch((error: unknown) => {
      writeEvent(response, {
        type: 'error',
        message: error instanceof AppError
          ? error.message
          : '智能助手暂时不可用，请稍后重试'
      })
      response.end()
    })
}
