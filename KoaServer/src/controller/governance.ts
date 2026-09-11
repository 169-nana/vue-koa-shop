import type { GovernanceQuery, GovernancePage, GovernancePreview, GovernanceRecordDetail } from '../../../shared/api'
import type {
  EnforcementGoods,
  EnforcementInput,
  EnforcementRecord,
  MerchantApplication,
  RejectionReasonOption,
  ReviewRecord
} from '../../../shared/api'
import type { AppMiddleware } from '../types'
import { AppError, getBody } from '../utils/input'
import { requireAdmin } from '../utils/identity'
import { fail, success } from '../utils/response'
import * as governanceService from '../service/governance'
import * as moderationService from '../service/moderation'

function enforcementInput(value: unknown): EnforcementInput | null {
  const body = getBody(value)
  if (typeof body.business_id !== 'number' || !Array.isArray(body.reason_ids) || body.reason_ids.length > 50) return null
  if (body.reason_ids.some(id => typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0)) return null
  if (typeof body.additional_note !== 'string') return null
  const businessId = body.business_id
  const reasonIds = body.reason_ids.filter((id): id is number => typeof id === 'number')
  const note = typeof body.additional_note === 'string' ? body.additional_note.trim() : ''
  const businessType = body.business_type
  const action = body.action
  if (typeof body.expected_version !== 'string' || !/^[a-f0-9]{64}$/.test(body.expected_version)) return null
  if (body.confirmation_name !== undefined && (typeof body.confirmation_name !== 'string' || body.confirmation_name.length > 200)) return null
  if ((businessType !== 'goods' && businessType !== 'merchant') || !Number.isSafeInteger(businessId) || businessId <= 0) return null
  if (action !== 'force_off_sale' && action !== 'suspend' && action !== 'revoke' && action !== 'restore') return null
  if ((businessType === 'goods') !== (action === 'force_off_sale')) return null
  if (reasonIds.some(id => !Number.isInteger(id) || id <= 0) || note.length > 500) return null
  return { expected_version: body.expected_version, confirmation_name: body.confirmation_name, business_type: businessType, business_id: businessId, action, reason_ids: [...new Set(reasonIds)], additional_note: note }
}

export function parseQuery(value: Record<string, unknown>): GovernanceQuery {
  const page = Number(value.page ?? 1), size = Number(value.page_size ?? 20)
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000 || !Number.isInteger(size) || size < 1 || size > 100) throw new AppError('分页参数不正确', 'INVALID_QUERY')
  const query: GovernanceQuery = { page, page_size: size }
  for (const key of ['keyword', 'merchant', 'status', 'operator', 'start_date', 'end_date'] as const) {
    const raw = value[key]
    if (raw === undefined || raw === '') continue
    if (typeof raw !== 'string' || raw.length > 100) throw new AppError('筛选参数不正确', 'INVALID_QUERY')
    if ((key === 'start_date' || key === 'end_date') && (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || !Number.isFinite(Date.parse(raw)) || new Date(raw).toISOString().slice(0, 10) !== raw)) throw new AppError('日期格式不正确', 'INVALID_QUERY')
    query[key] = raw.trim()
  }
  if (query.start_date && query.end_date && query.start_date > query.end_date) throw new AppError('开始日期不能晚于结束日期', 'INVALID_QUERY')
  return query
}
function list<T>(handler: (query: GovernanceQuery) => Promise<GovernancePage<T>>): AppMiddleware<GovernancePage<T>> {
  return async ctx => {
    try { ctx.body = success(await handler(parseQuery(ctx.query))) }
    catch (error) { if (error instanceof AppError) { ctx.body = fail(error.message); return }; throw error }
  }
}
export const goods = list<EnforcementGoods>(governanceService.listGoods)
export const merchants = list<MerchantApplication>(governanceService.listMerchants)
export const reviewRecords = list<ReviewRecord>(governanceService.listReviewRecords)
export const enforcementRecords = list<EnforcementRecord>(governanceService.listEnforcementRecords)
export const preview: AppMiddleware<GovernancePreview> = async ctx => {
  const id = Number(ctx.query.id), type = ctx.query.type
  if (!Number.isSafeInteger(id) || id <= 0 || (type !== 'goods' && type !== 'merchant')) { ctx.body = fail('对象参数不正确'); return }
  try { ctx.body = success(await governanceService.preview(type, id)) }
  catch (error) { if (error instanceof AppError) { ctx.body = fail(error.message); return }; throw error }
}
export const detail: AppMiddleware<GovernanceRecordDetail> = async ctx => {
  const id = Number(ctx.query.id), kind = ctx.query.kind
  if (!Number.isSafeInteger(id) || id <= 0 || (kind !== 'reviews' && kind !== 'records')) { ctx.body = fail('记录参数不正确'); return }
  try { ctx.body = success(await governanceService.detail(kind, id)) }
  catch (error) { if (error instanceof AppError) { ctx.body = fail(error.message); return }; throw error }
}
export const reasons: AppMiddleware<RejectionReasonOption[]> = async ctx => {
  const scene = ctx.query.scene
  if (scene !== 'goods_enforcement' && scene !== 'merchant_enforcement') { ctx.body = fail('违规处置场景不正确'); return }
  ctx.body = success(await moderationService.listReasons(scene))
}
export const enforce: AppMiddleware<null> = async ctx => {
  const input = enforcementInput(ctx.request.body)
  if (!input) { ctx.body = fail('违规处置参数不正确'); return }
  try { await governanceService.enforce(requireAdmin(ctx), input); ctx.body = success() }
  catch (error) { if (error instanceof AppError) { ctx.body = fail(error.message); return }; throw error }
}
