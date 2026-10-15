import type {
  AdminAfterSaleApplication,
  AfterSaleDecisionInput,
  AfterSaleRequestType,
  RefundApplication,
  RefundStatus
} from '../../../shared/api'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import type { OrderRow, RefundRow } from '../db/types'
import db from '../db'
import { AppError } from '../utils/input'
import { randomUUID } from 'node:crypto'

const statuses: RefundStatus[] = ['pending', 'approved', 'rejected']
const toDate = (value: Date | string) => value instanceof Date ? value.toISOString() : value

type ExtendedRefundRow = RefundRow & {
  order_item_id: number | null
  goods_name: string | null
  quantity: number | null
  request_type: string
  source: string
  review_note: string
  reviewed_at: Date | string | null
}

type AgentRefundItemRow = RowDataPacket & {
  order_id: number
  order_no: string
  status: string
  order_item_id: number
  goods_name: string
  goods_spec: string
  unit_price: string
  purchased_quantity: number
}

const requestTypes: AfterSaleRequestType[] = ['refund_only', 'return_refund']

function toRefund(row: ExtendedRefundRow): RefundApplication {
  const status = statuses.find(item => item === row.status)
  const requestType = requestTypes.find(item => item === row.request_type)
  if (!status) throw new AppError('售后状态异常', 'INVALID_REFUND_STATUS')
  if (!requestType) throw new AppError('售后类型异常', 'INVALID_REFUND_TYPE')
  return {
    id: row.id,
    order_id: row.order_id,
    order_no: row.order_no,
    refund_amount: Number(row.refund_amount),
    reason: row.reason,
    status,
    request_type: requestType,
    order_item_id: row.order_item_id,
    goods_name: row.goods_name,
    quantity: row.quantity,
    source: row.source === 'agent' ? 'agent' : 'manual',
    review_note: row.review_note,
    reviewed_at: row.reviewed_at ? toDate(row.reviewed_at) : null,
    created_at: toDate(row.created_at)
  }
}

export const create = async (userId: number, orderId: number, reason: string): Promise<number> => {
  const connection = await db.getConnection()
  try {
    await connection.beginTransaction()
    const [orders] = await connection.execute<OrderRow[]>(
      `SELECT id, order_no, user_id, status, total_amount, receiver_name,
        receiver_phone, receiver_address, created_at
       FROM vueshop_order WHERE id = ? AND user_id = ? LIMIT 1 FOR UPDATE`,
      [orderId, userId]
    )
    const order = orders[0]
    if (!order) throw new AppError('订单不存在', 'ORDER_NOT_FOUND')
    if (order.status !== 'paid' && order.status !== 'shipped') {
      throw new AppError('只有已支付或已发货订单可以申请售后', 'REFUND_STATUS_INVALID')
    }
    const applicationKey = `order:${orderId}`
    const [existing] = await connection.execute<RefundRow[]>(
      `SELECT r.id, r.order_id, o.order_no, r.user_id, r.refund_amount,
        r.reason, r.status, r.created_at
       FROM vueshop_order_refund AS r
       INNER JOIN vueshop_order AS o ON o.id = r.order_id
       WHERE r.order_id = ? LIMIT 1`,
      [orderId]
    )
    if (existing[0]) throw new AppError('该订单已经提交过售后申请', 'REFUND_EXISTS')

    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO vueshop_order_refund
        (order_id, user_id, application_key, refund_amount, reason, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [orderId, userId, applicationKey, order.total_amount, reason]
    )
    await connection.commit()
    return result.insertId
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export const findByUserId = async (userId: number): Promise<RefundApplication[]> => {
  const [rows] = await db.execute<ExtendedRefundRow[]>(
    `SELECT r.id, r.order_id, o.order_no, r.user_id, r.refund_amount,
      r.reason, r.status, r.request_type, r.order_item_id, i.goods_name,
      r.quantity, r.source, r.review_note, r.reviewed_at, r.created_at
     FROM vueshop_order_refund AS r
     INNER JOIN vueshop_order AS o ON o.id = r.order_id
     LEFT JOIN vueshop_order_item AS i ON i.id = r.order_item_id
     WHERE r.user_id = ? ORDER BY r.id DESC`,
    [userId]
  )
  return rows.map(toRefund)
}

export async function createFromAgent(
  userId: number,
  orderId: number,
  orderItemId: number,
  quantity: number,
  requestType: AfterSaleRequestType,
  reason: string
): Promise<number> {
  const connection = await db.getConnection()
  try {
    await connection.beginTransaction()
    const [rows] = await connection.execute<AgentRefundItemRow[]>(
      `SELECT o.id AS order_id, o.order_no, o.status, i.id AS order_item_id,
        i.goods_name, i.goods_spec, i.unit_price, i.quantity AS purchased_quantity
       FROM vueshop_order AS o
       INNER JOIN vueshop_order_item AS i ON i.order_id = o.id
       WHERE o.id = ? AND o.user_id = ? AND i.id = ? LIMIT 1 FOR UPDATE`,
      [orderId, userId, orderItemId]
    )
    const item = rows[0]
    if (!item) throw new AppError('订单商品不存在或不属于当前账号', 'AFTER_SALE_ITEM_NOT_FOUND')
    if (item.status !== 'paid' && item.status !== 'shipped') {
      throw new AppError('只有已支付或已发货订单可以申请售后', 'REFUND_STATUS_INVALID')
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > item.purchased_quantity) {
      throw new AppError(`申请数量应为1到${item.purchased_quantity}`, 'AFTER_SALE_QUANTITY_INVALID')
    }
    const applicationKey = `item:${orderItemId}`
    const [existing] = await connection.execute<(RowDataPacket & { id: number })[]>(
      `SELECT id FROM vueshop_order_refund
       WHERE application_key IN (?, ?) LIMIT 1`,
      [applicationKey, `order:${orderId}`]
    )
    if (existing[0]) throw new AppError('该订单商品已经提交过售后申请', 'REFUND_EXISTS')

    const refundAmount = (moneyToCents(item.unit_price) * quantity / 100).toFixed(2)
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO vueshop_order_refund (
        order_id, order_item_id, quantity, request_type, user_id,
        application_key, refund_amount, reason, source, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'agent', 'pending')`,
      [orderId, orderItemId, quantity, requestType, userId,
        applicationKey, refundAmount, reason]
    )
    await connection.commit()
    return result.insertId
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

function moneyToCents(value: string): number {
  const [yuan = '0', decimal = ''] = value.split('.')
  return Number(yuan) * 100 + Number(decimal.padEnd(2, '0').slice(0, 2))
}

type AdminRefundRow = ExtendedRefundRow & { username: string; handler_name: string | null }

export async function listForAdmin(status?: RefundStatus): Promise<AdminAfterSaleApplication[]> {
  const values: string[] = []
  const where = status ? 'WHERE r.status = ?' : ''
  if (status) values.push(status)
  const [rows] = await db.execute<AdminRefundRow[]>(
    `SELECT r.id, r.order_id, o.order_no, r.user_id, u.username,
      r.refund_amount, r.reason, r.status, r.request_type, r.order_item_id,
      i.goods_name, r.quantity, r.source, r.review_note, r.reviewed_at,
      r.created_at, a.username AS handler_name
     FROM vueshop_order_refund AS r
     INNER JOIN vueshop_order AS o ON o.id = r.order_id
     INNER JOIN vueshop_user AS u ON u.id = r.user_id
     LEFT JOIN vueshop_order_item AS i ON i.id = r.order_item_id
     LEFT JOIN vueshop_admin AS a ON a.id = r.reviewed_by
     ${where} ORDER BY r.id DESC LIMIT 200`,
    values
  )
  return rows.map(row => ({ ...toRefund(row), username: row.username, handler_name: row.handler_name }))
}

export async function decide(id: number, adminId: number, input: AfterSaleDecisionInput): Promise<void> {
  const connection = await db.getConnection()
  try {
    await connection.beginTransaction()
    const [applications] = await connection.execute<(RowDataPacket & {
      id: number; order_id: number; order_item_id: number | null; quantity: number | null
      request_type: string; refund_amount: string; status: string
    })[]>(
      `SELECT id, order_id, order_item_id, quantity, request_type, refund_amount, status
       FROM vueshop_order_refund WHERE id = ? LIMIT 1 FOR UPDATE`, [id]
    )
    const application = applications[0]
    if (!application || application.status !== 'pending') {
      throw new AppError('售后申请不存在或已经处理', 'AFTER_SALE_ALREADY_REVIEWED')
    }
    if (input.decision === 'approved') {
      const [payments] = await connection.execute<(RowDataPacket & { id: number; amount: string; status: string })[]>(
        `SELECT id, amount, status FROM vueshop_payment_order
         WHERE order_id = ? AND status IN ('succeeded', 'refunded') LIMIT 1 FOR UPDATE`, [application.order_id]
      )
      const payment = payments[0]
      if (!payment) throw new AppError('原支付单不存在，不能退款', 'PAYMENT_NOT_FOUND')
      const refundNo = `REF${Date.now()}${randomUUID().replaceAll('-', '').slice(0, 10)}`
      await connection.execute(
        `INSERT INTO vueshop_refund_transaction
         (refund_no, refund_application_id, payment_id, provider, amount, status, provider_refund_id, succeeded_at)
         VALUES (?, ?, ?, 'mock', ?, 'succeeded', ?, NOW())`,
        [refundNo, id, payment.id, application.refund_amount, `MOCK-${refundNo}`]
      )
      if (application.request_type === 'return_refund' && application.order_item_id && application.quantity) {
        await connection.execute(
          `UPDATE vueshop_goods g INNER JOIN vueshop_order_item i ON i.goods_id = g.id
           SET g.stock = g.stock + ? WHERE i.id = ?`, [application.quantity, application.order_item_id]
        )
      }
      const [approved] = await connection.execute<(RowDataPacket & { total: string })[]>(
        `SELECT COALESCE(SUM(refund_amount), 0) + ? AS total FROM vueshop_order_refund
         WHERE order_id = ? AND status = 'approved'`, [application.refund_amount, application.order_id]
      )
      if (Number(approved[0]?.total ?? 0) >= Number(payment.amount)) {
        await connection.execute("UPDATE vueshop_payment_order SET status = 'refunded' WHERE id = ?", [payment.id])
        await connection.execute("UPDATE vueshop_order SET status = 'refunded' WHERE id = ?", [application.order_id])
      }
    }
    const [result] = await connection.execute<ResultSetHeader>(
      `UPDATE vueshop_order_refund SET status = ?, reviewed_by = ?, review_note = ?, reviewed_at = NOW()
       WHERE id = ? AND status = 'pending'`, [input.decision, adminId, input.note, id]
    )
    if (result.affectedRows !== 1) throw new AppError('售后申请不存在或已经处理', 'AFTER_SALE_ALREADY_REVIEWED')
    await connection.commit()
  } catch (error) { await connection.rollback(); throw error }
  finally { connection.release() }
}
