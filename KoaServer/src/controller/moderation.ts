import type {
  GoodsSubmission,
  MerchantApplication,
  RejectionReasonOption,
  ReviewInput,
  ReviewScene
} from '../../../shared/api'
import type { AppMiddleware } from '../types'
import { AppError, getBody } from '../utils/input'
import { fail, success } from '../utils/response'
import { requireAdmin } from '../utils/identity'
import * as moderationService from '../service/moderation'

const merchantStatuses = new Set(['pending', 'approved', 'rejected', 'suspended', 'revoked'])
const submissionStatuses = new Set(['draft', 'pending', 'approved', 'rejected'])

function getReviewInput(value: unknown): ReviewInput | null {
  const body = getBody(value), id = Number(body.id)
  const reasonIds = Array.isArray(body.reason_ids) ? body.reason_ids.map(Number) : []
  const note = typeof body.additional_note === 'string' ? body.additional_note.trim() : ''
  if (!Number.isInteger(id) || id <= 0 || (body.decision !== 'approved' && body.decision !== 'rejected')) return null
  if (reasonIds.some(reasonId => !Number.isInteger(reasonId) || reasonId <= 0) || note.length > 500) return null
  return { id, decision: body.decision, reason_ids: [...new Set(reasonIds)], additional_note: note }
}

async function runReview(ctx: Parameters<AppMiddleware>[0], scene: ReviewScene) {
  const input = getReviewInput(ctx.request.body)
  if (!input) { ctx.body = fail('审核参数不正确'); return }
  try {
    if (scene === 'merchant_application') await moderationService.reviewMerchant(requireAdmin(ctx).id, input)
    else await moderationService.reviewGoods(requireAdmin(ctx).id, input)
    ctx.body = success()
  } catch (error) {
    if (error instanceof AppError) { ctx.body = fail(error.message); return }
    throw error
  }
}

export const reasons: AppMiddleware<RejectionReasonOption[]> = async ctx => {
  const scene = ctx.query.scene
  if (scene !== 'merchant_application' && scene !== 'goods_submission') { ctx.body = fail('审核场景不正确'); return }
  ctx.body = success(await moderationService.listReasons(scene))
}

export const merchantList: AppMiddleware<MerchantApplication[]> = async ctx => {
  const status = typeof ctx.query.status === 'string' && ctx.query.status ? ctx.query.status : undefined
  if (status && !merchantStatuses.has(status)) { ctx.body = fail('申请状态不正确'); return }
  ctx.body = success(await moderationService.listMerchants(status))
}

export const goodsList: AppMiddleware<GoodsSubmission[]> = async ctx => {
  const status = typeof ctx.query.status === 'string' && ctx.query.status ? ctx.query.status : undefined
  if (status && !submissionStatuses.has(status)) { ctx.body = fail('商品审核状态不正确'); return }
  ctx.body = success(await moderationService.listGoodsSubmissions(status))
}

export const reviewMerchant: AppMiddleware<null> = async ctx => runReview(ctx, 'merchant_application')
export const reviewGoods: AppMiddleware<null> = async ctx => runReview(ctx, 'goods_submission')
