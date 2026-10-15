import { randomUUID } from 'node:crypto'

import jwt from 'jsonwebtoken'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'

import type {
  ShopAgentActionResult,
  ShopAgentPendingAction
} from '../../../shared/api'
import { parseGoodsSpecs } from '../../../shared/goods'

import config from '../config'
import db from '../db'
import { AppError, getBody } from '../utils/input'
import * as addressService from './address'
import * as cartService from './cart'
import * as goodsService from './goods'
import { recordAgentConversion } from './agentObservability'
import { signAgentActionToken, type AgentActionContext } from './agentActionToken'

const ACTION_ISSUER = 'vueshop-agent'
const ACTION_AUDIENCE = 'vueshop-agent-action'
const ACTION_TTL_SECONDS = 5 * 60

interface CartActionPayload {
  goodsId: number
  quantity: number
  selectedSpec: string
  addressId: number
}

type AgentActionRow = RowDataPacket & {
  id: string
  payload: string | CartActionPayload
}

function parseActionPayload(value: unknown): CartActionPayload | null {
  let parsed: unknown = value
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value)
    } catch {
      return null
    }
  }
  const body = getBody(parsed)
  return typeof body.goodsId === 'number' && Number.isInteger(body.goodsId) && body.goodsId > 0 &&
    typeof body.quantity === 'number' && Number.isInteger(body.quantity) && body.quantity > 0 &&
    typeof body.selectedSpec === 'string' && body.selectedSpec.length > 0 &&
    typeof body.addressId === 'number' && Number.isInteger(body.addressId) && body.addressId > 0
    ? {
        goodsId: body.goodsId,
        quantity: body.quantity,
        selectedSpec: body.selectedSpec,
        addressId: body.addressId
      }
    : null
}

function verifyActionToken(token: string, userId: number): string {
  let decoded: string | jwt.JwtPayload
  try {
    decoded = jwt.verify(token, config.jwtSecret, {
      issuer: ACTION_ISSUER,
      audience: ACTION_AUDIENCE
    })
  } catch {
    throw new AppError('确认操作已失效，请重新发起', 'AGENT_ACTION_INVALID')
  }

  if (
    typeof decoded === 'string' ||
    decoded.type !== 'agent_cart_action' ||
    decoded.userId !== userId ||
    typeof decoded.actionId !== 'string'
  ) {
    throw new AppError('确认操作与当前账号不匹配', 'AGENT_ACTION_FORBIDDEN')
  }
  return decoded.actionId
}

export async function prepareAddToCart(
  userId: number,
  goodsId: number,
  quantity: number,
  requestedSpec?: string,
  actionContext?: AgentActionContext
): Promise<ShopAgentPendingAction> {
  const product = await goodsService.findPublicById(goodsId)
  if (!product) throw new AppError('商品不存在或当前不可售', 'GOODS_NOT_FOUND')
  if (quantity > product.stock) {
    throw new AppError(`库存不足，当前最多可购买${product.stock}件`, 'INSUFFICIENT_STOCK')
  }

  const specs = parseGoodsSpecs(product.spec)
  const selectedSpec = requestedSpec?.trim() || (specs.length === 1 ? specs[0] : undefined)
  if (!selectedSpec || !specs.includes(selectedSpec)) {
    throw new AppError(`请选择商品规格：${specs.join('、')}`, 'INVALID_GOODS_SPEC')
  }

  const address = (await addressService.findByUserId(userId))[0]
  if (!address) {
    throw new AppError('请先在收货地址页面添加地址，再使用智能加购', 'ADDRESS_NOT_FOUND')
  }

  const actionId = randomUUID()
  const expiresAt = new Date(Date.now() + ACTION_TTL_SECONDS * 1000)
  const payload: CartActionPayload = {
    goodsId,
    quantity,
    selectedSpec,
    addressId: address.id
  }
  const title = `将“${product.name}”加入购物车`
  const description = `规格：${selectedSpec}，数量：${quantity}，单价：¥${product.price.toFixed(2)}`

  await db.execute(
    `
      INSERT INTO vueshop_agent_action (
        id, user_id, conversation_id, request_id, action_type, payload,
        title, description, expires_at
      ) VALUES (?, ?, ?, ?, 'add_to_cart', ?, ?, ?, ?)
    `,
    [
      actionId, userId, actionContext?.conversationId ?? null,
      actionContext?.requestId ?? null, JSON.stringify(payload), title, description, expiresAt
    ]
  )

  const token = signAgentActionToken('add_to_cart', userId, actionId, expiresAt)

  void recordAgentConversion({
    userId,
    requestKey: `user:${userId}`,
    eventType: 'action_prepared',
    goodsId,
    actionId
  })

  return {
    type: 'add_to_cart',
    token,
    title,
    description,
    expires_at: expiresAt.toISOString()
  }
}

export async function executeAddToCart(
  userId: number,
  token: string
): Promise<ShopAgentActionResult> {
  const actionId = verifyActionToken(token, userId)
  const [claim] = await db.execute<ResultSetHeader>(
    `
      UPDATE vueshop_agent_action
      SET status = 'executing', executed_at = NOW()
      WHERE id = ? AND user_id = ? AND action_type = 'add_to_cart'
        AND status = 'prepared' AND expires_at > NOW()
    `,
    [actionId, userId]
  )
  if (claim.affectedRows !== 1) {
    throw new AppError('该确认操作已执行或已过期', 'AGENT_ACTION_USED')
  }

  const [rows] = await db.execute<AgentActionRow[]>(
    'SELECT id, payload FROM vueshop_agent_action WHERE id = ? AND user_id = ? LIMIT 1',
    [actionId, userId]
  )
  const payload = parseActionPayload(rows[0]?.payload)
  if (!payload) {
    await db.execute(
      "UPDATE vueshop_agent_action SET status = 'failed', error_code = 'INVALID_PAYLOAD' WHERE id = ?",
      [actionId]
    )
    throw new AppError('确认操作数据异常，请重新发起', 'AGENT_ACTION_INVALID')
  }

  try {
    await cartService.add(
      userId,
      payload.goodsId,
      payload.quantity,
      payload.selectedSpec,
      payload.addressId
    )
  } catch (error: unknown) {
    await db.execute(
      "UPDATE vueshop_agent_action SET status = 'failed', error_code = ? WHERE id = ?",
      [error instanceof AppError ? error.code : 'UNKNOWN_ERROR', actionId]
    )
    throw error
  }

  try {
    await db.execute(
      "UPDATE vueshop_agent_action SET status = 'succeeded' WHERE id = ?",
      [actionId]
    )
  } catch (error: unknown) {
    console.error(
      'Agent cart action succeeded but audit update failed:',
      error instanceof Error ? error.message : 'Unknown error'
    )
  }

  void recordAgentConversion({
    userId,
    requestKey: `user:${userId}`,
    eventType: 'add_to_cart',
    goodsId: payload.goodsId,
    actionId
  })
  return { message: '商品已加入购物车', cart_path: '/cart' }
}
