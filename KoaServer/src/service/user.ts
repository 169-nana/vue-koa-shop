import type { UserDashboard } from '../../../shared/api'
import type { UserState } from '../types'
import type { ResultSetHeader } from 'mysql2/promise'
import type { DashboardRow, UserRow, UserPasswordRow } from '../db/types'
import db from '../db'

// 根据用户名查询用户
export const findByUsername = async (username: string): Promise<(UserState & { password: string }) | null> => {
  const sql = `
    SELECT
      id,
      username,
      password,
      avatar,
      status
    FROM vueshop_user
    WHERE username = ?
    LIMIT 1
  `

  const [rows] = await db.execute<UserPasswordRow[]>(sql, [
    username
  ])

  return rows[0] || null
}

// 根据ID查询用户公开信息
export const findById = async (id: number): Promise<UserState | null> => {
  const sql = `
    SELECT
      id,
      username,
      avatar,
      status
    FROM vueshop_user
    WHERE id = ?
    LIMIT 1
  `

  const [rows] = await db.execute<UserRow[]>(sql, [id])

  return rows[0] || null
}

// 创建用户
export const create = async ({
  username,
  passwordHash
}: { username: string; passwordHash: string }) => {
  const sql = `
    INSERT INTO vueshop_user (
      username,
      password,
      avatar,
      status
    )
    VALUES (?, ?, '', 1)
  `

  const [result] = await db.execute<ResultSetHeader>(sql, [
    username,
    passwordHash
  ])

  return result.insertId
}

export const updateAvatar = async (userId: number, avatar: string): Promise<void> => {
  await db.execute(
    'UPDATE vueshop_user SET avatar = ? WHERE id = ?',
    [avatar, userId]
  )
}

export const getDashboard = async (userId: number): Promise<UserDashboard> => {
  const [rows] = await db.execute<DashboardRow[]>(
    `
      SELECT
        (SELECT COALESCE(SUM(quantity), 0) FROM vueshop_cart WHERE user_id = ?) AS cart_count,
        (SELECT COUNT(*) FROM vueshop_order WHERE user_id = ? AND status = 'pending') AS pending_order_count,
        (SELECT COUNT(*) FROM vueshop_order_refund WHERE user_id = ? AND status = 'pending') AS after_sale_count,
        (
          SELECT COUNT(*)
          FROM vueshop_order_item AS oi
          INNER JOIN vueshop_order AS o ON o.id = oi.order_id
          LEFT JOIN vueshop_goods_review AS r ON r.order_item_id = oi.id
          WHERE o.user_id = ? AND o.status = 'completed' AND r.id IS NULL
        ) AS reviewable_count
    `,
    [userId, userId, userId, userId]
  )
  const row = rows[0]
  return {
    cart_count: Number(row?.cart_count ?? 0),
    pending_order_count: Number(row?.pending_order_count ?? 0),
    after_sale_count: Number(row?.after_sale_count ?? 0),
    reviewable_count: Number(row?.reviewable_count ?? 0)
  }
}
