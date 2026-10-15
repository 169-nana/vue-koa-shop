import { randomUUID } from 'node:crypto'

import jwt from 'jsonwebtoken'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'

import type {
  AgentSupportTicket,
  AgentSupportTicketDecisionInput,
  ShopAgentSupportActionResult,
  ShopAgentSupportPendingAction
} from '../../../shared/api'

import config from '../config'
import db from '../db'
import { AppError, getBody } from '../utils/input'
import { recordAgentConversion } from './agentObservability'
import { signAgentActionToken, type AgentActionContext } from './agentActionToken'

const TTL_SECONDS = 5 * 60
const ISSUER = 'vueshop-agent'
const AUDIENCE = 'vueshop-agent-action'

interface TicketPayload { orderId: number | null; subject: string; summary: string }
type ActionRow = RowDataPacket & { payload: string | TicketPayload }
type TicketRow = RowDataPacket & Omit<AgentSupportTicket, 'status'> & { status: string }

function parsePayload(value: unknown): TicketPayload | null {
  let parsed: unknown = value
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed) } catch { return null }
  }
  const body = getBody(parsed)
  if ((body.orderId !== null && (typeof body.orderId !== 'number' || !Number.isInteger(body.orderId) || body.orderId <= 0)) ||
    typeof body.subject !== 'string' || body.subject.length < 2 || body.subject.length > 120 ||
    typeof body.summary !== 'string' || body.summary.length < 5 || body.summary.length > 500) return null
  return { orderId: body.orderId, subject: body.subject, summary: body.summary }
}

async function verifyOrder(userId: number, orderId: number | null): Promise<void> {
  if (orderId === null) return
  const [rows] = await db.execute<(RowDataPacket & { id: number })[]>(
    'SELECT id FROM vueshop_order WHERE id = ? AND user_id = ? LIMIT 1',
    [orderId, userId]
  )
  if (!rows[0]) throw new AppError('关联订单不存在或不属于当前账号', 'ORDER_NOT_FOUND')
}

export async function prepareSupportTicket(
  userId: number,
  payload: TicketPayload,
  actionContext?: AgentActionContext
): Promise<ShopAgentSupportPendingAction> {
  await verifyOrder(userId, payload.orderId)
  const actionId = randomUUID()
  const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000)
  const title = `联系人工客服：${payload.subject}`
  const description = payload.summary
  await db.execute(
    `INSERT INTO vueshop_agent_action
      (id, user_id, conversation_id, request_id, action_type, payload, title, description, expires_at)
     VALUES (?, ?, ?, ?, 'create_support_ticket', ?, ?, ?, ?)`,
    [actionId, userId, actionContext?.conversationId ?? null, actionContext?.requestId ?? null,
      JSON.stringify(payload), title, description, expiresAt]
  )
  const token = signAgentActionToken('create_support_ticket', userId, actionId, expiresAt)
  return {
    type: 'create_support_ticket', token,
    title,
    description,
    expires_at: expiresAt.toISOString()
  }
}

function verifyToken(token: string, userId: number): string {
  let decoded: string | jwt.JwtPayload
  try { decoded = jwt.verify(token, config.jwtSecret, { issuer: ISSUER, audience: AUDIENCE }) }
  catch { throw new AppError('确认操作已失效，请重新发起', 'AGENT_ACTION_INVALID') }
  if (typeof decoded === 'string' || decoded.type !== 'agent_support_action' ||
    decoded.userId !== userId || typeof decoded.actionId !== 'string') {
    throw new AppError('确认操作与当前账号不匹配', 'AGENT_ACTION_FORBIDDEN')
  }
  return decoded.actionId
}

export async function executeSupportTicket(userId: number, token: string): Promise<ShopAgentSupportActionResult> {
  const actionId = verifyToken(token, userId)
  const [claim] = await db.execute<ResultSetHeader>(
    `UPDATE vueshop_agent_action SET status = 'executing', executed_at = NOW()
     WHERE id = ? AND user_id = ? AND action_type = 'create_support_ticket'
       AND status = 'prepared' AND expires_at > NOW()`,
    [actionId, userId]
  )
  if (claim.affectedRows !== 1) throw new AppError('该确认操作已执行或已过期', 'AGENT_ACTION_USED')
  const [rows] = await db.execute<ActionRow[]>(
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
    await verifyOrder(userId, payload.orderId)
    const [result] = await db.execute<ResultSetHeader>(
      `INSERT INTO vueshop_agent_support_ticket
        (user_id, order_id, subject, summary, status)
       VALUES (?, ?, ?, ?, 'open')`,
      [userId, payload.orderId, payload.subject, payload.summary]
    )
    await db.execute("UPDATE vueshop_agent_action SET status = 'succeeded' WHERE id = ?", [actionId])
    await recordAgentConversion({
      userId, requestKey: `user:${userId}`, eventType: 'support_ticket_created', actionId
    })
    return { message: '人工客服工单已创建', ticket_id: result.insertId }
  } catch (error: unknown) {
    await db.execute(
      "UPDATE vueshop_agent_action SET status = 'failed', error_code = ? WHERE id = ?",
      [error instanceof AppError ? error.code : 'UNKNOWN_ERROR', actionId]
    )
    throw error
  }
}

export async function listTickets(): Promise<AgentSupportTicket[]> {
  const [rows] = await db.execute<TicketRow[]>(
    `SELECT t.id, t.user_id, u.username, t.order_id, o.order_no,
      t.subject, t.summary, t.status, a.username AS handler_name,
      t.resolution, t.created_at, t.updated_at
     FROM vueshop_agent_support_ticket AS t
     INNER JOIN vueshop_user AS u ON u.id = t.user_id
     LEFT JOIN vueshop_order AS o ON o.id = t.order_id
     LEFT JOIN vueshop_admin AS a ON a.id = t.handler_id
     ORDER BY FIELD(t.status, 'open', 'in_progress', 'resolved'), t.id DESC
     LIMIT 200`
  )
  return rows.map(row => {
    if (row.status !== 'open' && row.status !== 'in_progress' && row.status !== 'resolved') {
      throw new AppError('客服工单状态异常', 'INVALID_TICKET_STATUS')
    }
    return { ...row, status: row.status }
  })
}

export async function updateTicket(
  adminId: number,
  input: AgentSupportTicketDecisionInput
): Promise<void> {
  const [result] = await db.execute<ResultSetHeader>(
    `UPDATE vueshop_agent_support_ticket
     SET status = ?, handler_id = ?, resolution = ?
     WHERE id = ? AND status <> 'resolved'`,
    [input.status, adminId, input.resolution, input.id]
  )
  if (result.affectedRows !== 1) throw new AppError('工单不存在或已经完成', 'TICKET_NOT_AVAILABLE')
}
