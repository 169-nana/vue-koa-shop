import type { PaymentOrder } from '../../../shared/api'
import type { AppMiddleware } from '../types'
import * as payment from '../service/payment'
import { requireUser } from '../utils/identity'
import { AppError, getBody } from '../utils/input'
import { fail, success } from '../utils/response'

const businessError = (error: unknown): string | null => error instanceof AppError ? error.message : null

export const create: AppMiddleware<PaymentOrder> = async ctx => {
  const orderId = Number(getBody(ctx.request.body).order_id)
  if (!Number.isInteger(orderId) || orderId <= 0) { ctx.body = fail('订单ID不正确'); return }
  try { ctx.body = success(await payment.create(requireUser(ctx).id, orderId)) }
  catch (error) { const message = businessError(error); if (message) { ctx.body = fail(message); return }; throw error }
}

export const mockPay: AppMiddleware<PaymentOrder> = async ctx => {
  const no = getBody(ctx.request.body).payment_no
  if (typeof no !== 'string' || !/^PAY[0-9a-f]{20,40}$/i.test(no)) { ctx.body = fail('支付单号不正确'); return }
  try { ctx.body = success(await payment.mockPay(requireUser(ctx).id, no)) }
  catch (error) { const message = businessError(error); if (message) { ctx.body = fail(message); return }; throw error }
}

export const callback: AppMiddleware<PaymentOrder> = async ctx => {
  const body = getBody(ctx.request.body)
  const eventId = typeof body.event_id === 'string' ? body.event_id : ''
  const no = typeof body.payment_no === 'string' ? body.payment_no : ''
  const amount = typeof body.amount === 'string' ? body.amount : ''
  const signature = typeof body.signature === 'string' ? body.signature : ''
  if (!eventId || !no || !/^\d+\.\d{2}$/.test(amount) || !payment.validCallbackSignature(eventId, no, amount, signature)) {
    ctx.status = 401; ctx.body = fail('支付回调验签失败'); return
  }
  try { ctx.body = success(await payment.succeed(eventId, no, amount)) }
  catch (error) { const message = businessError(error); if (message) { ctx.body = fail(message); return }; throw error }
}
