import { randomUUID } from 'node:crypto'

import jwt from 'jsonwebtoken'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'

import type {
  AfterSaleRequestType,
  AgentAfterSaleEligibility,
  OrderStatus,
  ShopAgentAfterSaleActionResult,
  ShopAgentAfterSalePendingAction
} from '../../../shared/api'

import config from '../config'
import db from '../db'
import { AppError, getBody } from '../utils/input'
import { recordAgentConversion } from './agentObservability'
import { signAgentActionToken, type AgentActionContext } from './agentActionToken'
import * as refundService from './refund'

const ACTION_ISSUER = 'vueshop-agent'
const ACTION_AUDIENCE = 'vueshop-agent-action'
const ACTION_TTL_SECONDS = 5 * 60
const ELIGIBLE_STATUSES: OrderStatus[] = ['paid', 'shipped']

interface EligibilityRow extends RowDataPacket {
  order_id: number
  order_no: string
  order_status: string
  order_item_id: number
  goods_name: string
  goods_spec: string
  unit_price: string
  purchased_quantity: number
  application_id: number | null
}

interface AfterSaleActionPayload {
  orderId: number
  orderItemId: number
  quantity: number
  requestType: AfterSaleRequestType
  reason: string
}

type AgentActionRow = RowDataPacket & { payload: string | AfterSaleActionPayload }

function moneyToCents(value: string): number {
  const [yuan = '0', decimal = ''] = value.split('.')
  return Number(yuan) * 100 + Number(decimal.padEnd(2, '0').slice(0, 2))
}

function orderStatus(value: string): OrderStatus {
  const statuses: OrderStatus[] = ['pending', 'paid', 'cancelled', 'shipped', 'completed', 'refunded']
  const status = statuses.find(item => item === value)
  if (!status) throw new AppError('订单状态异常', 'INVALID_ORDER_STATUS')
  return status
}

export async function getAfterSaleEligibility(
  userId: number,
  orderId: number,
  orderItemId: number,
  quantity: number
): Promise<AgentAfterSaleEligibility> {
  const [rows] = await db.execute<EligibilityRow[]>(
    `SELECT o.id AS order_id, o.order_no, o.status AS order_status,
      i.id AS order_item_id, i.goods_name, i.goods_spec, i.unit_price,
      i.quantity AS purchased_quantity, r.id AS application_id
     FROM vueshop_order AS o
     INNER JOIN vueshop_order_item AS i ON i.order_id = o.id
     LEFT JOIN vueshop_order_refund AS r ON r.order_id = o.id
       AND (r.order_item_id IS NULL OR r.order_item_id = i.id)
     WHERE o.id = ? AND o.user_id = ? AND i.id = ? LIMIT 1`,
    [orderId, userId, orderItemId]
  )
  const row = rows[0]
  if (!row) throw new AppError('订单商品不存在或不属于当前账号', 'AFTER_SALE_ITEM_NOT_FOUND')
  const status = orderStatus(row.order_status)
  let reason = '可以申请，提交后将由工作人员审核'
  let eligible = true
  if (!ELIGIBLE_STATUSES.includes(status)) {
    eligible = false
    reason = '只有已支付或已发货订单可以申请售后'
  } else if (!Number.isInteger(quantity) || quantity < 1 || quantity > row.purchased_quantity) {
    eligible = false
    reason = `申请数量应为1到${row.purchased_quantity}`
  } else if (row.application_id !== null) {
    eligible = false
    reason = '该订单商品已经提交过售后申请'
  }

  await recordAgentConversion({
    userId,
    requestKey: `user:${userId}`,
    eventType: 'after_sale_consulted',
    goodsId: undefined
  })
  return {
    eligible,
    reason,
    order_id: row.order_id,
    order_no: row.order_no,
    order_status: status,
    item: {
      order_item_id: row.order_item_id,
      goods_name: row.goods_name,
      goods_spec: row.goods_spec,
      purchased_quantity: row.purchased_quantity,
      requested_quantity: quantity,
      max_refund_amount: moneyToCents(row.unit_price) * quantity / 100
    }
  }
}

export async function prepareAfterSale(
  userId: number,
  payload: AfterSaleActionPayload,
  actionContext?: AgentActionContext
): Promise<ShopAgentAfterSalePendingAction> {
  const eligibility = await getAfterSaleEligibility(
    userId, payload.orderId, payload.orderItemId, payload.quantity
  )
  if (!eligibility.eligible || !eligibility.item) {
    throw new AppError(eligibility.reason, 'AFTER_SALE_INELIGIBLE')
  }
  const actionId = randomUUID()
  const expiresAt = new Date(Date.now() + ACTION_TTL_SECONDS * 1000)
  const title = `申请“${eligibility.item.goods_name}”售后`
  const description = `${payload.requestType === 'return_refund' ? '退货退款' : '仅退款'} · 数量${payload.quantity} · 预计金额¥${eligibility.item.max_refund_amount.toFixed(2)} · ${payload.reason}`
  await db.execute(
    `INSERT INTO vueshop_agent_action
      (id, user_id, conversation_id, request_id, action_type, payload, title, description, expires_at)
     VALUES (?, ?, ?, ?, 'apply_after_sale', ?, ?, ?, ?)`,
    [actionId, userId, actionContext?.conversationId ?? null, actionContext?.requestId ?? null,
      JSON.stringify(payload), title, description, expiresAt]
  )
  const token = signAgentActionToken('apply_after_sale', userId, actionId, expiresAt)
  await recordAgentConversion({
    userId,
    requestKey: `user:${userId}`,
    eventType: 'after_sale_prepared',
    actionId
  })
  return {
    type: 'apply_after_sale',
    token,
    title,
    description,
    expires_at: expiresAt.toISOString()
  }
}

function verifyToken(token: string, userId: number): string {
  let decoded: string | jwt.JwtPayload
  try {
    decoded = jwt.verify(token, config.jwtSecret, {
      issuer: ACTION_ISSUER,
      audience: ACTION_AUDIENCE
    })
  } catch {
    throw new AppError('确认操作已失效，请重新发起', 'AGENT_ACTION_INVALID')
  }
  if (typeof decoded === 'string' || decoded.type !== 'agent_after_sale_action' ||
    decoded.userId !== userId || typeof decoded.actionId !== 'string') {
    throw new AppError('确认操作与当前账号不匹配', 'AGENT_ACTION_FORBIDDEN')
  }
  return decoded.actionId
}

function parsePayload(value: unknown): AfterSaleActionPayload | null {
  let parsed: unknown = value
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed) } catch { return null }
  }
  const body = getBody(parsed)
  if (typeof body.orderId !== 'number' || !Number.isInteger(body.orderId) || body.orderId <= 0 ||
    typeof body.orderItemId !== 'number' || !Number.isInteger(body.orderItemId) || body.orderItemId <= 0 ||
    typeof body.quantity !== 'number' || !Number.isInteger(body.quantity) || body.quantity <= 0 ||
    (body.requestType !== 'refund_only' && body.requestType !== 'return_refund') ||
    typeof body.reason !== 'string' || body.reason.length < 5 || body.reason.length > 500) return null
  return {
    orderId: body.orderId,
    orderItemId: body.orderItemId,
    quantity: body.quantity,
    requestType: body.requestType,
    reason: body.reason
  }
}

export async function executeAfterSale(
  userId: number,
  token: string
): Promise<ShopAgentAfterSaleActionResult> {
  const actionId = verifyToken(token, userId)
  const [claim] = await db.execute<ResultSetHeader>(
    `UPDATE vueshop_agent_action SET status = 'executing', executed_at = NOW()
     WHERE id = ? AND user_id = ? AND action_type = 'apply_after_sale'
       AND status = 'prepared' AND expires_at > NOW()`,
    [actionId, userId]
  )
  if (claim.affectedRows !== 1) throw new AppError('该确认操作已执行或已过期', 'AGENT_ACTION_USED')
  const [rows] = await db.execute<AgentActionRow[]>(
    'SELECT payload FROM vueshop_agent_action WHERE id = ? AND user_id = ? LIMIT 1',
    [actionId, userId]
  )
  const payload = parsePayload(rows[0]?.payload)
  if (!payload) {
    await db.execute(
      "UPDATE vueshop_agent_action SET status = 'failed', error_code = 'INVALID_PAYLOAD' WHERE id = ?",
      [actionId]
    )
    throw new AppError('确认操作数据异常，请重新发起', 'AGENT_ACTION_INVALID')
  }
  try {
    const applicationId = await refundService.createFromAgent(
      userId, payload.orderId, payload.orderItemId, payload.quantity,
      payload.requestType, payload.reason
    )
    await db.execute("UPDATE vueshop_agent_action SET status = 'succeeded' WHERE id = ?", [actionId])
    await recordAgentConversion({
      userId,
      requestKey: `user:${userId}`,
      eventType: 'after_sale_submitted',
      actionId
    })
    return { message: '售后申请已提交，等待工作人员审核', application_id: applicationId, after_sale_path: '/after-sales' }
  } catch (error: unknown) {
    await db.execute(
      "UPDATE vueshop_agent_action SET status = 'failed', error_code = ? WHERE id = ?",
      [error instanceof AppError ? error.code : 'UNKNOWN_ERROR', actionId]
    )
    throw error
  }
}
