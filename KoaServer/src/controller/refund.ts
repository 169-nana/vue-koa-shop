import type { InsertResult, RefundApplication } from '../../../shared/api'
import type { AppMiddleware } from '../types'
import * as refundService from '../service/refund'
import { requireUser } from '../utils/identity'
import { AppError, getBody } from '../utils/input'
import { fail, success } from '../utils/response'

export const list: AppMiddleware<RefundApplication[]> = async ctx => {
  const user = requireUser(ctx)
  ctx.body = success(await refundService.findByUserId(user.id))
}

export const create: AppMiddleware<InsertResult> = async ctx => {
  const user = requireUser(ctx)
  const body = getBody(ctx.request.body)
  const orderId = Number(body.order_id)
  const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
  if (!Number.isInteger(orderId) || orderId <= 0) { ctx.body = fail('订单ID不正确'); return }
  if (reason.length < 5 || reason.length > 500) { ctx.body = fail('售后原因必须是5到500个字符'); return }
  try {
    ctx.body = success({ insertId: await refundService.create(user.id, orderId, reason) })
  } catch (error: unknown) {
    if (error instanceof AppError) { ctx.body = fail(error.message); return }
    throw error
  }
}
