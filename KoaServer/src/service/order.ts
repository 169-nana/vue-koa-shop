import { randomInt } from 'node:crypto'
import type { ResultSetHeader } from 'mysql2/promise'
import type {
  CreateOrderInput,
  CreateOrderResult,
  OrderDetail,
  OrderItem,
  OrderStatus,
  OrderSummary
} from '../../../shared/api'
import type {
  AddressRow,
  OrderCheckoutRow,
  OrderItemRow,
  OrderRow
} from '../db/types'

import db from '../db'
import { AppError } from '../utils/input'
import { parseGoodsSpecs } from '../../../shared/goods'

const ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'paid',
  'cancelled',
  'shipped',
  'completed'
]

function getOrderStatus(value: string): OrderStatus {
  const status = ORDER_STATUSES.find(item => item === value)
  if (!status) throw new AppError('订单状态异常', 'INVALID_ORDER_STATUS')
  return status
}

function moneyToCents(value: string): number {
  const [yuan = '0', decimal = ''] = value.split('.')
  return Number(yuan) * 100 + Number(decimal.padEnd(2, '0').slice(0, 2))
}

function createOrderNo(): string {
  const suffix = randomInt(0, 1_000_000).toString().padStart(6, '0')
  return `${Date.now()}${suffix}`
}

function toOrderSummary(row: OrderRow): OrderSummary {
  return {
    id: row.id,
    order_no: row.order_no,
    status: getOrderStatus(row.status),
    total_amount: Number(row.total_amount),
    receiver_name: row.receiver_name,
    created_at: row.created_at instanceof Date
      ? row.created_at.toISOString()
      : row.created_at
  }
}

function toOrderItem(row: OrderItemRow): OrderItem {
  return {
    id: row.id,
    goods_id: row.goods_id,
    goods_name: row.goods_name,
    goods_picture: row.goods_picture,
    goods_spec: row.goods_spec,
    unit_price: Number(row.unit_price),
    quantity: row.quantity,
    subtotal: Number(row.subtotal)
  }
}

export const create = async (
  userId: number,
  input: CreateOrderInput
): Promise<CreateOrderResult> => {
  const connection = await db.getConnection()
  const cartIds = [...(input.cart_item_ids ?? [])].sort((a, b) => a - b)
  const placeholders = cartIds.map(() => '?').join(', ')

  try {
    await connection.beginTransaction()

    const [addresses] = await connection.execute<AddressRow[]>(
      `
        SELECT id, user_id, receiver_name, receiver_phone,
          receiver_address, is_default
        FROM vueshop_user_address
        WHERE id = ? AND user_id = ?
        LIMIT 1
      `,
      [input.address_id, userId]
    )
    const address = addresses[0]
    if (!address) throw new AppError('请选择有效的收货地址', 'ADDRESS_NOT_FOUND')

    let rows: OrderCheckoutRow[]
    if (input.direct_item) {
      const direct = input.direct_item
      const [directRows] = await connection.execute<OrderCheckoutRow[]>(
        `
          SELECT
            NULL AS cart_id,
            g.id AS goods_id,
            g.name AS goods_name,
            g.picture AS goods_picture,
            ? AS goods_spec,
            g.spec AS available_spec,
            g.price AS unit_price,
            ? AS quantity,
            g.stock
          FROM vueshop_goods AS g
          WHERE g.id = ? AND g.sale_status = 'on_sale'
          LIMIT 1
          FOR UPDATE
        `,
        [direct.selected_spec, direct.quantity, direct.goods_id]
      )
      rows = directRows
      if (rows.length !== 1) throw new AppError('商品不存在', 'GOODS_NOT_FOUND')
    } else {
      const [cartRows] = await connection.execute<OrderCheckoutRow[]>(
        `
          SELECT
            c.id AS cart_id,
            c.goods_id,
            c.quantity,
            g.name AS goods_name,
            g.picture AS goods_picture,
            c.selected_spec AS goods_spec,
            g.spec AS available_spec,
            g.price AS unit_price,
            g.stock
          FROM vueshop_cart AS c
          INNER JOIN vueshop_goods AS g
            ON g.id = c.goods_id
          WHERE c.user_id = ?
            AND c.id IN (${placeholders})
            AND g.sale_status = 'on_sale'
          ORDER BY c.id ASC
          FOR UPDATE
        `,
        [userId, ...cartIds]
      )
      rows = cartRows
    }

    if (!input.direct_item && rows.length !== cartIds.length) {
      throw new AppError('部分购物车商品不存在，请刷新后重试', 'CART_ITEM_NOT_FOUND')
    }

    let totalInCents = 0
    for (const item of rows) {
      if (!parseGoodsSpecs(item.available_spec).includes(item.goods_spec)) {
        throw new AppError(`${item.goods_name}的所选规格已失效`, 'INVALID_GOODS_SPEC')
      }
      if (item.quantity > item.stock) {
        throw new AppError(`${item.goods_name}库存不足`, 'INSUFFICIENT_STOCK')
      }
      totalInCents += moneyToCents(item.unit_price) * item.quantity
    }

    const orderNo = createOrderNo()
    const totalAmount = (totalInCents / 100).toFixed(2)
    const [orderResult] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO vueshop_order (
          order_no,
          user_id,
          status,
          total_amount,
          receiver_name,
          receiver_phone,
          receiver_address
        )
        VALUES (?, ?, 'pending', ?, ?, ?, ?)
      `,
      [
        orderNo,
        userId,
        totalAmount,
        address.receiver_name,
        address.receiver_phone,
        address.receiver_address
      ]
    )

    const itemPlaceholders = rows.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ')
    const itemValues = rows.flatMap(item => {
      const subtotal = (moneyToCents(item.unit_price) * item.quantity / 100).toFixed(2)
      return [
        orderResult.insertId,
        item.goods_id,
        item.goods_name,
        item.goods_picture,
        item.goods_spec,
        item.unit_price,
        item.quantity,
        subtotal
      ]
    })

    await connection.execute(
      `
        INSERT INTO vueshop_order_item (
          order_id,
          goods_id,
          goods_name,
          goods_picture,
          goods_spec,
          unit_price,
          quantity,
          subtotal
        )
        VALUES ${itemPlaceholders}
      `,
      itemValues
    )

    for (const item of rows) {
      const [stockResult] = await connection.execute<ResultSetHeader>(
        `
          UPDATE vueshop_goods
          SET stock = stock - ?
          WHERE id = ?
            AND stock >= ?
        `,
        [item.quantity, item.goods_id, item.quantity]
      )

      if (stockResult.affectedRows === 0) {
        throw new AppError(`${item.goods_name}库存不足`, 'INSUFFICIENT_STOCK')
      }
    }

    if (cartIds.length > 0) {
      await connection.execute(
        `
          DELETE FROM vueshop_cart
          WHERE user_id = ?
            AND id IN (${placeholders})
        `,
        [userId, ...cartIds]
      )
    }

    await connection.commit()
    return { id: orderResult.insertId, order_no: orderNo }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export const findByUserId = async (
  userId: number,
  status?: OrderStatus
): Promise<OrderSummary[]> => {
  const [rows] = await db.execute<OrderRow[]>(
    `
      SELECT
        id,
        order_no,
        user_id,
        status,
        total_amount,
        receiver_name,
        receiver_phone,
        receiver_address,
        created_at
      FROM vueshop_order
      WHERE user_id = ?
        AND (? IS NULL OR status = ?)
      ORDER BY id DESC
    `,
    [userId, status ?? null, status ?? null]
  )
  return rows.map(toOrderSummary)
}

export const findDetail = async (
  userId: number,
  orderId: number
): Promise<OrderDetail | null> => {
  const [orders] = await db.execute<OrderRow[]>(
    `
      SELECT
        id,
        order_no,
        user_id,
        status,
        total_amount,
        receiver_name,
        receiver_phone,
        receiver_address,
        created_at
      FROM vueshop_order
      WHERE id = ? AND user_id = ?
      LIMIT 1
    `,
    [orderId, userId]
  )
  const order = orders[0]
  if (!order) return null

  const [items] = await db.execute<OrderItemRow[]>(
    `
      SELECT
        id,
        order_id,
        goods_id,
        goods_name,
        goods_picture,
        goods_spec,
        unit_price,
        quantity,
        subtotal
      FROM vueshop_order_item
      WHERE order_id = ?
      ORDER BY id ASC
    `,
    [orderId]
  )

  return {
    ...toOrderSummary(order),
    receiver_phone: order.receiver_phone,
    receiver_address: order.receiver_address,
    items: items.map(toOrderItem)
  }
}

export const cancel = async (userId: number, orderId: number): Promise<void> => {
  const connection = await db.getConnection()

  try {
    await connection.beginTransaction()
    const [orders] = await connection.execute<OrderRow[]>(
      `
        SELECT
          id,
          order_no,
          user_id,
          status,
          total_amount,
          receiver_name,
          receiver_phone,
          receiver_address,
          created_at
        FROM vueshop_order
        WHERE id = ? AND user_id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [orderId, userId]
    )
    const order = orders[0]

    if (!order) throw new AppError('订单不存在', 'ORDER_NOT_FOUND')
    if (order.status !== 'pending') {
      throw new AppError('只有待支付订单可以取消', 'ORDER_STATUS_INVALID')
    }

    const [items] = await connection.execute<OrderItemRow[]>(
      `
        SELECT
          id,
          order_id,
          goods_id,
          goods_name,
          goods_picture,
          goods_spec,
          unit_price,
          quantity,
          subtotal
        FROM vueshop_order_item
        WHERE order_id = ?
        ORDER BY goods_id ASC
      `,
      [orderId]
    )

    for (const item of items) {
      await connection.execute(
        'UPDATE vueshop_goods SET stock = stock + ? WHERE id = ?',
        [item.quantity, item.goods_id]
      )
    }

    await connection.execute(
      "UPDATE vueshop_order SET status = 'cancelled' WHERE id = ?",
      [orderId]
    )
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}
