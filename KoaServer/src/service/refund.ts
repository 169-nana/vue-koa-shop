import type { RefundApplication, RefundStatus } from '../../../shared/api'
import type { ResultSetHeader } from 'mysql2/promise'
import type { OrderRow, RefundRow } from '../db/types'
import db from '../db'
import { AppError } from '../utils/input'

const statuses: RefundStatus[] = ['pending', 'approved', 'rejected']
const toDate = (value: Date | string) => value instanceof Date ? value.toISOString() : value

function toRefund(row: RefundRow): RefundApplication {
  const status = statuses.find(item => item === row.status)
  if (!status) throw new AppError('售后状态异常', 'INVALID_REFUND_STATUS')
  return {
    id: row.id,
    order_id: row.order_id,
    order_no: row.order_no,
    refund_amount: Number(row.refund_amount),
    reason: row.reason,
    status,
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
        (order_id, user_id, refund_amount, reason, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [orderId, userId, order.total_amount, reason]
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
  const [rows] = await db.execute<RefundRow[]>(
    `SELECT r.id, r.order_id, o.order_no, r.user_id, r.refund_amount,
      r.reason, r.status, r.created_at
     FROM vueshop_order_refund AS r
     INNER JOIN vueshop_order AS o ON o.id = r.order_id
     WHERE r.user_id = ? ORDER BY r.id DESC`,
    [userId]
  )
  return rows.map(toRefund)
}
