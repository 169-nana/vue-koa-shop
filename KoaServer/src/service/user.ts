import type { UserState } from '../types'
import type { ResultSetHeader } from 'mysql2/promise'
import type { UserRow, UserPasswordRow } from '../db/types'
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