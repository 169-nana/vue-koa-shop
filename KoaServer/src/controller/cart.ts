import type { CartItem } from '../../../shared/api'
import type { AppMiddleware } from '../types'

import * as cartService from '../service/cart'
import { requireUser } from '../utils/identity'
import {
  AppError,
  getBody
} from '../utils/input'
import {
  fail,
  success
} from '../utils/response'

/**
 * GET /home/cart
 *
 * 查询当前登录用户的购物车。
 */
export const list:
  AppMiddleware<CartItem[]> =
  async ctx => {
    const user = requireUser(ctx)

    const items =
      await cartService.findByUserId(
        user.id
      )

    ctx.body = success(items)
  }

/**
 * POST /home/cart/add
 *
 * 将商品加入当前用户的购物车。
 */
export const add:
  AppMiddleware<null> =
  async ctx => {
    const user = requireUser(ctx)
    const body = getBody(ctx.request.body)
    const goodsId = Number(body.goods_id)
    const quantity = Number(body.quantity)
    const selectedSpec = typeof body.selected_spec === 'string'
      ? body.selected_spec.trim()
      : ''
    const addressId = Number(body.address_id)

    if (
      !Number.isInteger(goodsId) ||
      goodsId <= 0
    ) {
      ctx.body = fail('商品ID不正确')
      return
    }

    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 999
    ) {
      ctx.body = fail(
        '购买数量必须是1到999之间的整数'
      )
      return
    }

    if (!selectedSpec || selectedSpec.length > 255) {
      ctx.body = fail('请选择商品规格')
      return
    }

    if (!Number.isInteger(addressId) || addressId <= 0) {
      ctx.body = fail('请选择收货地址')
      return
    }

    try {
      await cartService.add(
        user.id,
        goodsId,
        quantity,
        selectedSpec,
        addressId
      )

      ctx.body = success()
    } catch (error: unknown) {
      /*
       * AppError 表示可以直接告诉用户的业务错误，
       * 例如商品不存在、库存不足。
       */
      if (error instanceof AppError) {
        ctx.body = fail(error.message)
        return
      }

      /*
       * 未知数据库错误不能伪装成普通业务错误，
       * 继续交给全局错误中间件记录和处理。
       */
      throw error
    }
  }

/** POST /home/cart/update */
export const update:
  AppMiddleware<null> = async ctx => {
    const user = requireUser(ctx)
    const body = getBody(ctx.request.body)
    const cartId = Number(body.id)
    const quantity = Number(body.quantity)

    if (!Number.isInteger(cartId) || cartId <= 0) {
      ctx.body = fail('购物车记录ID不正确')
      return
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
      ctx.body = fail('购买数量必须是1到999之间的整数')
      return
    }

    try {
      await cartService.updateQuantity(user.id, cartId, quantity)
      ctx.body = success()
    } catch (error: unknown) {
      if (error instanceof AppError) {
        ctx.body = fail(error.message)
        return
      }
      throw error
    }
  }

/** POST /home/cart/remove */
export const remove:
  AppMiddleware<null> = async ctx => {
    const user = requireUser(ctx)
    const cartId = Number(getBody(ctx.request.body).id)

    if (!Number.isInteger(cartId) || cartId <= 0) {
      ctx.body = fail('购物车记录ID不正确')
      return
    }

    try {
      await cartService.remove(user.id, cartId)
      ctx.body = success()
    } catch (error: unknown) {
      if (error instanceof AppError) {
        ctx.body = fail(error.message)
        return
      }
      throw error
    }
  }
