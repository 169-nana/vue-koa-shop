import type {
  CreateOrderResult,
  OrderDetail,
  OrderStatus,
  OrderSummary
} from '../../../shared/api'
import type { AppMiddleware } from '../types'

import * as orderService from '../service/order'
import { requireUser } from '../utils/identity'
import { AppError, getBody } from '../utils/input'
import { fail, success } from '../utils/response'

function getBusinessMessage(error: unknown): string | null {
  return error instanceof AppError ? error.message : null
}

export const create: AppMiddleware<CreateOrderResult> = async ctx => {
  const user = requireUser(ctx)
  const body = getBody(ctx.request.body)
  const addressId = Number(body.address_id)
  if (!Number.isInteger(addressId) || addressId <= 0) {
    ctx.body = fail('请选择收货地址')
    return
  }

  const hasCartItems = Array.isArray(body.cart_item_ids)
  const hasDirectItem = typeof body.direct_item === 'object' && body.direct_item !== null
  if (hasCartItems === hasDirectItem) {
    ctx.body = fail('购物车结算和直接购买只能选择一种')
    return
  }

  let input
  if (hasCartItems) {
    const rawIds = body.cart_item_ids as unknown[]
    if (rawIds.length === 0 || rawIds.length > 100) {
      ctx.body = fail('请选择要结算的购物车商品')
      return
    }
    const cartItemIds = rawIds.map(Number)
    if (cartItemIds.some(id => !Number.isInteger(id) || id <= 0)) {
      ctx.body = fail('购物车商品编号不正确')
      return
    }
    const uniqueIds = [...new Set(cartItemIds)]
    if (uniqueIds.length !== cartItemIds.length) {
      ctx.body = fail('购物车商品不能重复提交')
      return
    }
    input = { cart_item_ids: uniqueIds, address_id: addressId }
  } else {
    const direct = getBody(body.direct_item)
    const goodsId = Number(direct.goods_id)
    const quantity = Number(direct.quantity)
    const selectedSpec = typeof direct.selected_spec === 'string'
      ? direct.selected_spec.trim()
      : ''
    if (!Number.isInteger(goodsId) || goodsId <= 0) {
      ctx.body = fail('商品ID不正确')
      return
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
      ctx.body = fail('购买数量必须是1到999之间的整数')
      return
    }
    if (!selectedSpec || selectedSpec.length > 255) {
      ctx.body = fail('请选择商品规格')
      return
    }
    input = {
      direct_item: { goods_id: goodsId, quantity, selected_spec: selectedSpec },
      address_id: addressId
    }
  }

  try {
    const result = await orderService.create(user.id, input)
    ctx.body = success(result)
  } catch (error: unknown) {
    const message = getBusinessMessage(error)
    if (message) {
      ctx.body = fail(message)
      return
    }
    throw error
  }
}

export const list: AppMiddleware<OrderSummary[]> = async ctx => {
  const user = requireUser(ctx)
  const rawStatus = ctx.query.status
  const allowedStatuses: OrderStatus[] = ['pending', 'paid', 'cancelled', 'shipped', 'completed', 'refunded']
  const status = typeof rawStatus === 'string'
    ? allowedStatuses.find(item => item === rawStatus)
    : undefined
  if (rawStatus !== undefined && !status) {
    ctx.body = fail('订单状态不正确')
    return
  }
  ctx.body = success(await orderService.findByUserId(user.id, status))
}

export const detail: AppMiddleware<OrderDetail> = async ctx => {
  const user = requireUser(ctx)
  const orderId = Number(ctx.query.id)
  if (!Number.isInteger(orderId) || orderId <= 0) {
    ctx.body = fail('订单ID不正确')
    return
  }

  const order = await orderService.findDetail(user.id, orderId)
  if (!order) {
    ctx.body = fail('订单不存在')
    return
  }
  ctx.body = success(order)
}

export const cancel: AppMiddleware<null> = async ctx => {
  const user = requireUser(ctx)
  const orderId = Number(getBody(ctx.request.body).id)
  if (!Number.isInteger(orderId) || orderId <= 0) {
    ctx.body = fail('订单ID不正确')
    return
  }

  try {
    await orderService.cancel(user.id, orderId)
    ctx.body = success()
  } catch (error: unknown) {
    const message = getBusinessMessage(error)
    if (message) {
      ctx.body = fail(message)
      return
    }
    throw error
  }
}

export const confirmReceipt: AppMiddleware<null> = async ctx => {
  const user = requireUser(ctx)
  const orderId = Number(getBody(ctx.request.body).order_id)
  if (!Number.isInteger(orderId) || orderId <= 0) { ctx.body = fail('订单ID不正确'); return }
  try { await orderService.confirmReceipt(user.id, orderId); ctx.body = success() }
  catch (error) { const message = getBusinessMessage(error); if (message) { ctx.body = fail(message); return }; throw error }
}
