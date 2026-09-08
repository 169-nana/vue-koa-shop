import type { GoodsReview, ReviewableItem } from '../../../shared/api'
import type { ResultSetHeader } from 'mysql2/promise'
import type { GoodsReviewRow, ReviewableRow } from '../db/types'
import db from '../db'
import { AppError } from '../utils/input'

const toDate = (value: Date | string) => value instanceof Date ? value.toISOString() : value

export const findReviewable = async (userId: number): Promise<ReviewableItem[]> => {
  const [rows] = await db.execute<ReviewableRow[]>(
    `SELECT oi.id AS order_item_id, o.id AS order_id, oi.goods_id,
      oi.goods_name, oi.goods_picture, oi.goods_spec, o.created_at
     FROM vueshop_order_item AS oi
     INNER JOIN vueshop_order AS o ON o.id = oi.order_id
     LEFT JOIN vueshop_goods_review AS r ON r.order_item_id = oi.id
     WHERE o.user_id = ? AND o.status = 'completed' AND r.id IS NULL
     ORDER BY oi.id DESC`,
    [userId]
  )
  return rows.map(row => ({ ...row, created_at: toDate(row.created_at) }))
}

export const create = async (
  userId: number,
  orderItemId: number,
  rating: number,
  content: string
): Promise<number> => {
  const connection = await db.getConnection()
  try {
    await connection.beginTransaction()
    const [rows] = await connection.execute<ReviewableRow[]>(
      `SELECT oi.id AS order_item_id, o.id AS order_id, oi.goods_id,
        oi.goods_name, oi.goods_picture, oi.goods_spec, o.created_at
       FROM vueshop_order_item AS oi
       INNER JOIN vueshop_order AS o ON o.id = oi.order_id
       WHERE oi.id = ? AND o.user_id = ? AND o.status = 'completed'
       LIMIT 1 FOR UPDATE`,
      [orderItemId, userId]
    )
    const item = rows[0]
    if (!item) throw new AppError('该商品暂时不能评价', 'REVIEW_NOT_ALLOWED')
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO vueshop_goods_review
        (user_id, order_item_id, goods_id, rating, content)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, orderItemId, item.goods_id, rating, content]
    )
    await connection.commit()
    return result.insertId
  } catch (error) {
    await connection.rollback()
    if (error instanceof Error && 'code' in error && error.code === 'ER_DUP_ENTRY') {
      throw new AppError('这个商品已经评价过了', 'REVIEW_EXISTS')
    }
    throw error
  } finally {
    connection.release()
  }
}

export const findByGoodsId = async (goodsId: number): Promise<GoodsReview[]> => {
  const [rows] = await db.execute<GoodsReviewRow[]>(
    `SELECT r.id, u.username, u.avatar, r.rating, r.content, r.created_at
     FROM vueshop_goods_review AS r
     INNER JOIN vueshop_user AS u ON u.id = r.user_id
     WHERE r.goods_id = ? ORDER BY r.id DESC LIMIT 100`,
    [goodsId]
  )
  return rows.map(row => ({ ...row, created_at: toDate(row.created_at) }))
}
