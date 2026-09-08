import type { GoodsReview, InsertResult, ReviewableItem } from '../../../shared/api'
import type { AppMiddleware } from '../types'
import * as reviewService from '../service/review'
import { requireUser } from '../utils/identity'
import { AppError, getBody } from '../utils/input'
import { fail, success } from '../utils/response'

export const reviewable: AppMiddleware<ReviewableItem[]> = async ctx => {
  const user = requireUser(ctx)
  ctx.body = success(await reviewService.findReviewable(user.id))
}

export const create: AppMiddleware<InsertResult> = async ctx => {
  const user = requireUser(ctx)
  const body = getBody(ctx.request.body)
  const orderItemId = Number(body.order_item_id)
  const rating = Number(body.rating)
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  if (!Number.isInteger(orderItemId) || orderItemId <= 0) { ctx.body = fail('订单商品ID不正确'); return }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) { ctx.body = fail('评分必须是1到5星'); return }
  if (content.length < 2 || content.length > 1000) { ctx.body = fail('评价内容必须是2到1000个字符'); return }
  try {
    ctx.body = success({ insertId: await reviewService.create(user.id, orderItemId, rating, content) })
  } catch (error: unknown) {
    if (error instanceof AppError) { ctx.body = fail(error.message); return }
    throw error
  }
}

export const goodsList: AppMiddleware<GoodsReview[]> = async ctx => {
  const goodsId = Number(ctx.query.goods_id)
  if (!Number.isInteger(goodsId) || goodsId <= 0) { ctx.body = fail('商品ID不正确'); return }
  ctx.body = success(await reviewService.findByGoodsId(goodsId))
}
