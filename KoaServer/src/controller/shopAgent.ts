import type { ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'

import type {
  ShopAgentMessage,
  ShopAgentCancelResult,
  ShopAgentActionResult,
  ShopAgentAfterSaleActionResult,
  ShopAgentConversation,
  ShopAgentSupportActionResult,
  AgentFeedbackInput,
  ShopAgentHistoryPage,
  ShopAgentReply,
  ShopAgentStreamEvent
} from '../../../shared/api'

import type { AppContext, AppMiddleware } from '../types'

import { parseAgentMessages } from '../agent/validation'
import { recordAgentCall, recordAgentConversion } from '../service/agentObservability'
import { executeAddToCart } from '../service/agentCartAction'
import { executeAfterSale } from '../service/agentAfterSaleAction'
import { executeSupportTicket } from '../service/agentSupportTicket'
import {
  clearAgentChatHistory,
  getAgentChatHistory,
  saveAgentExchange
} from '../service/agentChatHistory'
import {
  createAgentConversation,
  deleteAgentConversation,
  getAgentConversationContext,
  listAgentConversations,
  referencedProducts,
  type AgentConversationState
} from '../service/agentConversation'
import {
  cancelAgentRequest,
  registerAgentRequest,
  unregisterAgentRequest
} from '../service/agentRequestRuntime'
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
  conversationId?: number,
  conversationContext?: AgentConversationState,
  onDelta?: (content: string) => void,
  onReset?: () => void,
  signal?: AbortSignal
): Promise<ShopAgentReply> {
  const startedAt = Date.now()

  try {
    const result = await runShopAgent(
      messages,
      ctx.state.user?.id,
      onDelta,
      onReset,
      undefined,
      conversationContext,
      { conversationId, requestId, signal }
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
    const latestMessage = messages[messages.length - 1]
    if (ctx.state.user && conversationId && latestMessage?.role === 'user') {
      try {
        await saveAgentExchange(
          ctx.state.user.id,
          conversationId,
          requestId,
          latestMessage.content,
          reply.message,
          referencedProducts(reply.products),
          conversationContext?.revision ?? 1
        )
      } catch (error: unknown) {
        console.warn(
          'Agent chat history unavailable:',
          error instanceof Error ? error.message : 'Unknown error'
        )
      }
    }
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

function bodyConversationId(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null
}

async function resolveConversation(
  ctx: AppContext
): Promise<{ id: number; context: AgentConversationState } | null> {
  if (!ctx.state.user) return null
  const requested = getBody(ctx.request.body).conversation_id
  if (requested === undefined) {
    const existing = (await listAgentConversations(ctx.state.user.id))[0]
    const conversation = existing ?? await createAgentConversation(ctx.state.user.id)
    return {
      id: conversation.id,
      context: await getAgentConversationContext(ctx.state.user.id, conversation.id)
    }
  }
  const conversationId = bodyConversationId(requested)
  if (conversationId === null) {
    throw new AppError('对话编号不正确', 'AGENT_CONVERSATION_INVALID')
  }
  return {
    id: conversationId,
    context: await getAgentConversationContext(ctx.state.user.id, conversationId)
  }
}

export const chat: AppMiddleware<ShopAgentReply> = async ctx => {
  const messages = parseMessages(ctx)

  if (!messages) {
    ctx.body = fail('对话内容不正确，最多提交12条消息，且最后一条必须来自用户')
    return
  }

  try {
    const conversation = await resolveConversation(ctx)
    ctx.body = success(await runAndRecord(
      ctx,
      messages,
      randomUUID(),
      conversation?.id,
      conversation?.context
    ))
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

function actionToken(value: unknown): string | null {
  const token = getBody(value).token
  return typeof token === 'string' && token.trim() && token.length <= 2000
    ? token.trim()
    : null
}

export const confirmAfterSale: AppMiddleware<ShopAgentAfterSaleActionResult> = async ctx => {
  const token = actionToken(ctx.request.body)
  if (!token) { ctx.body = fail('确认凭证不正确'); return }
  try {
    ctx.body = success(await executeAfterSale(requireUser(ctx).id, token))
  } catch (error: unknown) {
    if (error instanceof AppError) { ctx.body = fail(error.message); return }
    throw error
  }
}

export const confirmSupportTicket: AppMiddleware<ShopAgentSupportActionResult> = async ctx => {
  const token = actionToken(ctx.request.body)
  if (!token) { ctx.body = fail('确认凭证不正确'); return }
  try {
    ctx.body = success(await executeSupportTicket(requireUser(ctx).id, token))
  } catch (error: unknown) {
    if (error instanceof AppError) { ctx.body = fail(error.message); return }
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

function positiveInteger(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

export const history: AppMiddleware<ShopAgentHistoryPage> = async ctx => {
  const conversationValue = ctx.query.conversation_id
  const beforeValue = ctx.query.before_id
  const pageSizeValue = ctx.query.pagesize
  const beforeId = beforeValue === undefined ? null : positiveInteger(beforeValue)
  const conversationId = positiveInteger(conversationValue)
  const requestedPageSize = pageSizeValue === undefined ? 20 : positiveInteger(pageSizeValue)

  if (conversationId === null || (beforeValue !== undefined && beforeId === null) || requestedPageSize === null) {
    ctx.body = fail('聊天记录分页参数不正确')
    return
  }

  ctx.body = success(await getAgentChatHistory(
    requireUser(ctx).id,
    conversationId,
    beforeId,
    Math.min(requestedPageSize, 30)
  ))
}

export const clearHistory: AppMiddleware<null> = async ctx => {
  const conversationId = bodyConversationId(getBody(ctx.request.body).conversation_id)
  if (conversationId === null) { ctx.body = fail('对话编号不正确'); return }
  await getAgentConversationContext(requireUser(ctx).id, conversationId)
  await clearAgentChatHistory(requireUser(ctx).id, conversationId)
  ctx.body = success()
}

export const cancelRequest: AppMiddleware<ShopAgentCancelResult> = async ctx => {
  const requestId = getBody(ctx.request.body).request_id
  if (typeof requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(requestId)) {
    ctx.body = fail('请求编号不正确')
    return
  }
  ctx.body = success({ cancelled: cancelAgentRequest(requestId, requireUser(ctx).id) })
}

export const conversations: AppMiddleware<ShopAgentConversation[]> = async ctx => {
  ctx.body = success(await listAgentConversations(requireUser(ctx).id))
}

export const createConversation: AppMiddleware<ShopAgentConversation> = async ctx => {
  const titleValue = getBody(ctx.request.body).title
  if (titleValue !== undefined && (typeof titleValue !== 'string' || titleValue.trim().length > 60)) {
    ctx.body = fail('对话标题不正确')
    return
  }
  ctx.body = success(await createAgentConversation(
    requireUser(ctx).id,
    typeof titleValue === 'string' ? titleValue : undefined
  ))
}

export const deleteConversation: AppMiddleware<null> = async ctx => {
  const conversationId = bodyConversationId(getBody(ctx.request.body).id)
  if (conversationId === null) { ctx.body = fail('对话编号不正确'); return }
  try {
    await deleteAgentConversation(requireUser(ctx).id, conversationId)
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

  let conversation: Awaited<ReturnType<typeof resolveConversation>>
  try {
    conversation = await resolveConversation(ctx)
  } catch (error: unknown) {
    if (error instanceof AppError) { ctx.body = fail(error.message); return }
    throw error
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

  const controller = ctx.state.user
    ? registerAgentRequest(requestId, ctx.state.user.id)
    : new AbortController()
  const abortOnDisconnect = (): void => controller.abort()
  response.once('close', abortOnDisconnect)

  void runAndRecord(
    ctx,
    messages,
    requestId,
    conversation?.id,
    conversation?.context,
    content => writeEvent(response, { type: 'delta', content }),
    () => writeEvent(response, { type: 'reset' }),
    controller.signal
  )
    .then(reply => writeReply(response, reply))
    .catch((error: unknown) => {
      writeEvent(response, {
        type: 'error',
        message: error instanceof AppError
          ? error.message
          : '智能助手暂时不可用，请稍后重试'
      })
      if (!response.writableEnded) response.end()
    })
    .finally(() => {
      response.off('close', abortOnDisconnect)
      unregisterAgentRequest(requestId)
    })
}
