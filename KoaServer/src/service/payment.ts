import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import type { PaymentOrder, PaymentStatus } from '../../../shared/api'
import db from '../db'
import config from '../config'
import { AppError } from '../utils/input'

type PaymentRow = RowDataPacket & {
  id: number; payment_no: string; order_id: number; order_no: string; user_id: number
  provider: string; amount: string; status: string; expires_at: Date | string
  paid_at: Date | string | null
}
type ExpiredOrderRow = RowDataPacket & { id: number }
type StockRow = RowDataPacket & { goods_id: number; quantity: number }

const statuses: PaymentStatus[] = ['pending', 'succeeded', 'closed', 'failed', 'refunded']
const iso = (value: Date | string | null): string | null => value instanceof Date ? value.toISOString() : value
const paymentNo = (): string => `PAY${Date.now()}${randomUUID().replaceAll('-', '').slice(0, 10)}`

function toPayment(row: PaymentRow): PaymentOrder {
  const status = statuses.find(item => item === row.status)
  if (!status || row.provider !== 'mock') throw new AppError('支付单状态异常', 'PAYMENT_STATUS_INVALID')
  return {
    payment_no: row.payment_no,
    order_id: row.order_id,
    order_no: row.order_no,
    provider: 'mock',
    amount: Number(row.amount),
    status,
    expires_at: iso(row.expires_at)!,
    paid_at: iso(row.paid_at)
  }
}

async function closeOne(orderId: number): Promise<boolean> {
  const connection = await db.getConnection()
  try {
    await connection.beginTransaction()
    await connection.execute(
      "SELECT id FROM vueshop_payment_order WHERE order_id = ? AND status = 'pending' FOR UPDATE", [orderId]
    )
    const [orders] = await connection.execute<(RowDataPacket & { status: string })[]>(
      `SELECT status FROM vueshop_order WHERE id = ? AND status = 'pending'
       AND payment_expires_at <= NOW() LIMIT 1 FOR UPDATE`, [orderId]
    )
    if (!orders[0]) { await connection.rollback(); return false }
    const [items] = await connection.execute<StockRow[]>(
      'SELECT goods_id, quantity FROM vueshop_order_item WHERE order_id = ? ORDER BY goods_id FOR UPDATE', [orderId]
    )
    for (const item of items) {
      await connection.execute('UPDATE vueshop_goods SET stock = stock + ? WHERE id = ?', [item.quantity, item.goods_id])
    }
    await connection.execute(
      "UPDATE vueshop_order SET status = 'cancelled', cancelled_at = NOW() WHERE id = ? AND status = 'pending'", [orderId]
    )
    await connection.execute(
      "UPDATE vueshop_payment_order SET status = 'closed', closed_at = NOW() WHERE order_id = ? AND status = 'pending'", [orderId]
    )
    await connection.commit()
    return true
  } catch (error) {
    await connection.rollback()
    throw error
  } finally { connection.release() }
}

export async function closeExpiredOrders(limit = 100): Promise<number> {
  const [rows] = await db.execute<ExpiredOrderRow[]>(
    `SELECT id FROM vueshop_order WHERE status = 'pending' AND payment_expires_at <= NOW()
     ORDER BY id LIMIT ?`, [limit]
  )
  let closed = 0
  for (const row of rows) if (await closeOne(row.id)) closed += 1
  return closed
}

export async function create(userId: number, orderId: number): Promise<PaymentOrder> {
  await closeExpiredOrders()
  const connection = await db.getConnection()
  try {
    await connection.beginTransaction()
    const [orders] = await connection.execute<(RowDataPacket & {
      id: number; order_no: string; status: string; total_amount: string; payment_expires_at: Date | string
    })[]>(
      `SELECT id, order_no, status, total_amount, payment_expires_at FROM vueshop_order
       WHERE id = ? AND user_id = ? LIMIT 1 FOR UPDATE`, [orderId, userId]
    )
    const order = orders[0]
    if (!order) throw new AppError('订单不存在', 'ORDER_NOT_FOUND')
    if (order.status !== 'pending') throw new AppError('订单当前状态不能支付', 'ORDER_STATUS_INVALID')
    const [existing] = await connection.execute<PaymentRow[]>(
      `SELECT p.*, o.order_no FROM vueshop_payment_order p INNER JOIN vueshop_order o ON o.id = p.order_id
       WHERE p.order_id = ? AND p.provider = 'mock' LIMIT 1 FOR UPDATE`, [orderId]
    )
    if (existing[0]) { await connection.commit(); return toPayment(existing[0]) }
    const no = paymentNo()
    await connection.execute(
      `INSERT INTO vueshop_payment_order
       (payment_no, order_id, user_id, provider, amount, status, expires_at)
       VALUES (?, ?, ?, 'mock', ?, 'pending', ?)`,
      [no, orderId, userId, order.total_amount, order.payment_expires_at]
    )
    await connection.commit()
    return {
      payment_no: no, order_id: orderId, order_no: order.order_no, provider: 'mock',
      amount: Number(order.total_amount), status: 'pending', expires_at: iso(order.payment_expires_at)!, paid_at: null
    }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally { connection.release() }
}

export function callbackSignature(eventId: string, no: string, amount: string): string {
  return createHmac('sha256', config.paymentCallbackSecret).update(`${eventId}.${no}.${amount}`).digest('hex')
}

export function validCallbackSignature(eventId: string, no: string, amount: string, signature: string): boolean {
  const expected = Buffer.from(callbackSignature(eventId, no, amount), 'hex')
  const actual = /^[0-9a-f]{64}$/i.test(signature) ? Buffer.from(signature, 'hex') : Buffer.alloc(0)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export async function succeed(eventId: string, no: string, amount: string): Promise<PaymentOrder> {
  const connection = await db.getConnection()
  try {
    await connection.beginTransaction()
    const [payments] = await connection.execute<PaymentRow[]>(
      `SELECT p.*, o.order_no FROM vueshop_payment_order p INNER JOIN vueshop_order o ON o.id = p.order_id
       WHERE p.payment_no = ? LIMIT 1 FOR UPDATE`, [no]
    )
    const payment = payments[0]
    if (!payment) throw new AppError('支付单不存在', 'PAYMENT_NOT_FOUND')
    if (Number(payment.amount).toFixed(2) !== Number(amount).toFixed(2)) {
      throw new AppError('支付金额不一致', 'PAYMENT_AMOUNT_MISMATCH')
    }
    const [eventResult] = await connection.execute<ResultSetHeader>(
      `INSERT IGNORE INTO vueshop_payment_callback (provider, event_id, payment_no, payload)
       VALUES ('mock', ?, ?, ?)`, [eventId, no, JSON.stringify({ amount })]
    )
    if (eventResult.affectedRows === 0) {
      await connection.commit(); return toPayment(payment)
    }
    if (payment.status === 'succeeded') {
      await connection.commit(); return toPayment(payment)
    }
    if (payment.status !== 'pending' || new Date(payment.expires_at).getTime() <= Date.now()) {
      throw new AppError('支付单已关闭或过期', 'PAYMENT_EXPIRED')
    }
    const [orderResult] = await connection.execute<ResultSetHeader>(
      `UPDATE vueshop_order SET status = 'paid', paid_at = NOW()
       WHERE id = ? AND user_id = ? AND status = 'pending'`, [payment.order_id, payment.user_id]
    )
    if (orderResult.affectedRows !== 1) throw new AppError('订单状态已变化', 'ORDER_STATUS_INVALID')
    await connection.execute(
      `UPDATE vueshop_payment_order SET status = 'succeeded', provider_transaction_id = ?, paid_at = NOW()
       WHERE id = ?`, [`MOCK-${eventId}`, payment.id]
    )
    await connection.commit()
    return { ...toPayment(payment), status: 'succeeded', paid_at: new Date().toISOString() }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally { connection.release() }
}

export async function mockPay(userId: number, no: string): Promise<PaymentOrder> {
  if (config.isProduction) throw new AppError('生产环境已禁用模拟支付', 'MOCK_PAYMENT_DISABLED')
  const [rows] = await db.execute<(RowDataPacket & { amount: string })[]>(
    "SELECT amount FROM vueshop_payment_order WHERE payment_no = ? AND user_id = ? AND provider = 'mock' LIMIT 1", [no, userId]
  )
  if (!rows[0]) throw new AppError('支付单不存在', 'PAYMENT_NOT_FOUND')
  return succeed(randomUUID(), no, rows[0].amount)
}
