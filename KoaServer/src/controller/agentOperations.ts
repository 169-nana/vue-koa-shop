import type {
  AgentEvalCase,
  AgentEvalCaseInput,
  AgentEvalRunResult,
  AgentKnowledgeInput,
  AgentKnowledgeRecord,
  AgentMetrics,
  AgentPromptVersion,
  AdminAfterSaleApplication,
  AgentSupportTicket,
  RefundStatus,
  InsertResult
} from '../../../shared/api'

import type { AppMiddleware } from '../types'

import * as operations from '../service/agentOperations'
import * as refundService from '../service/refund'
import * as supportService from '../service/agentSupportTicket'
import { requireAdmin } from '../utils/identity'
import { AppError, getBody } from '../utils/input'
import { fail, success } from '../utils/response'

function positiveId(value: unknown): number | null {
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

function optionalDate(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || value.length > 30 || !Number.isFinite(Date.parse(value))) {
    return undefined
  }
  const normalized = value.replace('T', ' ')
  return normalized.length === 16 ? `${normalized}:00` : normalized
}

function containsSecret(value: string): boolean {
  return /(?:sk-[a-z0-9_-]{16,}|api[_ -]?key\s*[:=]\s*\S+|deepseek_api_key)/i.test(value)
}

function parseKnowledge(value: unknown): AgentKnowledgeInput | null {
  const body = getBody(value)
  const id = body.id === undefined ? undefined : positiveId(body.id)
  const validFrom = optionalDate(body.valid_from)
  const validUntil = optionalDate(body.valid_until)
  if (
    (body.id !== undefined && id === null) ||
    typeof body.category !== 'string' || !body.category.trim() || body.category.length > 40 ||
    typeof body.title !== 'string' || !body.title.trim() || body.title.length > 120 ||
    typeof body.keywords !== 'string' || body.keywords.length > 500 ||
    typeof body.content !== 'string' || !body.content.trim() || body.content.length > 5000 ||
    typeof body.enabled !== 'boolean' ||
    typeof body.sort_order !== 'number' || !Number.isInteger(body.sort_order) ||
    body.sort_order < 0 || body.sort_order > 100000 ||
    validFrom === undefined || validUntil === undefined ||
    (validFrom && validUntil && validFrom > validUntil)
  ) return null
  return {
    ...(id ? { id } : {}),
    category: body.category.trim(),
    title: body.title.trim(),
    keywords: body.keywords.trim(),
    content: body.content.trim(),
    enabled: body.enabled,
    sort_order: body.sort_order,
    valid_from: validFrom,
    valid_until: validUntil
  }
}

function stringList(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > 20) return null
  const list: string[] = []
  for (const item of value) {
    if (typeof item !== 'string' || !item.trim() || item.length > 100) return null
    list.push(item.trim())
  }
  return [...new Set(list)]
}

function parseEvalCase(value: unknown): AgentEvalCaseInput | null {
  const body = getBody(value)
  const id = body.id === undefined ? undefined : positiveId(body.id)
  const expected = stringList(body.expected_keywords)
  const forbidden = stringList(body.forbidden_keywords)
  if (
    (body.id !== undefined && id === null) ||
    typeof body.name !== 'string' || !body.name.trim() || body.name.length > 120 ||
    typeof body.question !== 'string' || !body.question.trim() || body.question.length > 1000 ||
    expected === null || forbidden === null ||
    typeof body.require_tool !== 'boolean' || typeof body.enabled !== 'boolean' ||
    typeof body.min_product_count !== 'number' || !Number.isInteger(body.min_product_count) ||
    body.min_product_count < 0 || body.min_product_count > 8 ||
    typeof body.sort_order !== 'number' || !Number.isInteger(body.sort_order) ||
    body.sort_order < 0 || body.sort_order > 100000
  ) return null
  return {
    ...(id ? { id } : {}),
    name: body.name.trim(),
    question: body.question.trim(),
    expected_keywords: expected,
    forbidden_keywords: forbidden,
    require_tool: body.require_tool,
    min_product_count: body.min_product_count,
    enabled: body.enabled,
    sort_order: body.sort_order
  }
}

async function respond<T>(ctx: Parameters<AppMiddleware<T>>[0], task: () => Promise<T>): Promise<void> {
  try {
    ctx.body = success(await task())
  } catch (error: unknown) {
    if (error instanceof AppError) {
      ctx.body = fail(error.message)
      return
    }
    throw error
  }
}

export const metrics: AppMiddleware<AgentMetrics> = async ctx => {
  const days = Number(ctx.query.days ?? 7)
  if (![7, 30, 90].includes(days)) { ctx.body = fail('统计周期不正确'); return }
  ctx.body = success(await operations.getMetrics(days))
}

export const knowledgeList: AppMiddleware<AgentKnowledgeRecord[]> = async ctx => {
  ctx.body = success(await operations.listKnowledge())
}

export const knowledgeSave: AppMiddleware<InsertResult> = async ctx => {
  const input = parseKnowledge(ctx.request.body)
  if (!input) { ctx.body = fail('知识条目参数不正确'); return }
  await respond(ctx, async () => ({
    insertId: await operations.saveKnowledge(requireAdmin(ctx).id, input)
  }))
}

export const knowledgeDisable: AppMiddleware<null> = async ctx => {
  const id = positiveId(getBody(ctx.request.body).id)
  if (!id) { ctx.body = fail('知识条目ID不正确'); return }
  await respond(ctx, async () => {
    await operations.disableKnowledge(id, requireAdmin(ctx).id)
    return null
  })
}

export const promptList: AppMiddleware<AgentPromptVersion[]> = async ctx => {
  ctx.body = success(await operations.listPromptVersions())
}

export const promptCreate: AppMiddleware<InsertResult> = async ctx => {
  const content = getBody(ctx.request.body).content
  if (typeof content !== 'string' || content.trim().length < 100 || content.length > 12000) {
    ctx.body = fail('Prompt 内容应为100到12000个字符')
    return
  }
  if (containsSecret(content)) {
    ctx.body = fail('Prompt 中不能包含 API Key 或疑似密钥内容')
    return
  }
  ctx.body = success({
    insertId: await operations.createPromptVersion(requireAdmin(ctx).id, content.trim())
  })
}

export const promptPublish: AppMiddleware<null> = async ctx => {
  const id = positiveId(getBody(ctx.request.body).id)
  if (!id) { ctx.body = fail('Prompt 版本ID不正确'); return }
  await respond(ctx, async () => {
    await operations.publishPrompt(id, requireAdmin(ctx).id)
    return null
  })
}

export const evalCaseList: AppMiddleware<AgentEvalCase[]> = async ctx => {
  ctx.body = success(await operations.listEvalCases())
}

export const evalCaseSave: AppMiddleware<InsertResult> = async ctx => {
  const input = parseEvalCase(ctx.request.body)
  if (!input) { ctx.body = fail('评测用例参数不正确'); return }
  await respond(ctx, async () => ({
    insertId: await operations.saveEvalCase(requireAdmin(ctx).id, input)
  }))
}

export const evalRun: AppMiddleware<AgentEvalRunResult> = async ctx => {
  const id = positiveId(getBody(ctx.request.body).prompt_version_id)
  if (!id) { ctx.body = fail('Prompt 版本ID不正确'); return }
  await respond(ctx, () => operations.runEvaluation(id, requireAdmin(ctx).id))
}

export const afterSaleList: AppMiddleware<AdminAfterSaleApplication[]> = async ctx => {
  const raw = ctx.query.status
  const status: RefundStatus | undefined = raw === undefined || raw === ''
    ? undefined
    : raw === 'pending' || raw === 'approved' || raw === 'rejected'
      ? raw
      : undefined
  if (raw !== undefined && raw !== '' && status === undefined) {
    ctx.body = fail('售后状态不正确')
    return
  }
  ctx.body = success(await refundService.listForAdmin(status))
}

export const afterSaleDecision: AppMiddleware<null> = async ctx => {
  const body = getBody(ctx.request.body)
  const id = positiveId(body.id)
  const decision = body.decision
  const note = typeof body.note === 'string' ? body.note.trim() : ''
  if (!id || (decision !== 'approved' && decision !== 'rejected') ||
    note.length < 2 || note.length > 500) {
    ctx.body = fail('售后处理参数不正确，处理说明应为2到500个字符')
    return
  }
  await respond(ctx, async () => {
    await refundService.decide(id, requireAdmin(ctx).id, { id, decision, note })
    return null
  })
}

export const supportTicketList: AppMiddleware<AgentSupportTicket[]> = async ctx => {
  ctx.body = success(await supportService.listTickets())
}

export const supportTicketUpdate: AppMiddleware<null> = async ctx => {
  const body = getBody(ctx.request.body)
  const id = positiveId(body.id)
  const status = body.status
  const resolution = typeof body.resolution === 'string' ? body.resolution.trim() : ''
  if (!id || (status !== 'in_progress' && status !== 'resolved') ||
    resolution.length > 500 || (status === 'resolved' && resolution.length < 2)) {
    ctx.body = fail('工单处理参数不正确，解决说明最多500个字符且完成时必填')
    return
  }
  await respond(ctx, async () => {
    await supportService.updateTicket(requireAdmin(ctx).id, { id, status, resolution })
    return null
  })
}
