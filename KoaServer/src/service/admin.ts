import type { AdminAccount, AdminRole, PublicAdmin } from '../../../shared/api'
import type { ResultSetHeader } from 'mysql2/promise'
import type { AdminRow, AdminPasswordRow } from '../db/types'
//负责查询数据，组织业务数据
import db from '../db/index'

//根据用户名查询管理员
export const findByUsername = async (username: string): Promise<(PublicAdmin & { password: string }) | null> => {
  //不能将用户传入的参数直接拼接到sql语句，利用？占位符防止SQL注入
  const sql = `
    SELECT id, username, password, avatar, role, status
    FROM vueshop_admin
    WHERE username = ?
    LIMIT 1
  `

  //mysql2模块的execute()方法会返回一个数组，第一个元素是查询结果，第二个元素是字段信息[rows, fields]
  //db.execute()会将[username]传入到？占位符中，防止SQL注入
  const [rows] = await db.execute<AdminPasswordRow[]>(sql, [username])

  return rows[0] || null
}

// 根据ID查询管理员公开信息
export const findById = async (id: number): Promise<PublicAdmin | null> => {
  const sql = `
    SELECT id, username, avatar, role, status
    FROM vueshop_admin
    WHERE id = ?
    LIMIT 1
  `

  const [rows] = await db.execute<AdminRow[]>(sql, [id])

  return rows[0] || null
}

// 修改管理员密码
export const findPasswordById = async (id: number): Promise<AdminPasswordRow | null> => {
  const [rows] = await db.execute<AdminPasswordRow[]>(
    'SELECT id, username, password, avatar, role, status FROM vueshop_admin WHERE id = ? LIMIT 1', [id]
  )
  return rows[0] || null
}

export const updatePassword = async (
  id: number,
  passwordHash: string,
  previousHash: string
) => {
  const sql = `
    UPDATE vueshop_admin
    SET password = ?
    WHERE id = ? AND password = ?
  `

  const [result] = await db.execute<ResultSetHeader>(sql, [
    passwordHash,
    id,
    previousHash
  ])

  return result.affectedRows
}

// 修改管理员头像
export const updateAvatar = async (
  id: number,
  avatar: string
) => {
  const sql = `
    UPDATE vueshop_admin
    SET avatar = ?
    WHERE id = ?
  `

  const [result] = await db.execute<ResultSetHeader>(sql, [
    avatar,
    id
  ])

  return result.affectedRows
}

export const listAccounts = async (): Promise<AdminAccount[]> => {
  const [rows] = await db.execute<(AdminRow & { created_at?: Date | string })[]>(`
    SELECT id, username, avatar, role, status, NULL AS created_at
    FROM vueshop_admin ORDER BY id ASC
  `)
  return rows.map(row => ({ ...row, created_at: row.created_at ? String(row.created_at) : null }))
}

export const createAccount = async (username: string, passwordHash: string, role: AdminRole): Promise<number> => {
  const [result] = await db.execute<ResultSetHeader>(`
    INSERT INTO vueshop_admin (username, password, avatar, role, status)
    VALUES (?, ?, '', ?, 1)
  `, [username, passwordHash, role])
  return result.insertId
}

export const updateAccount = async (id: number, role: AdminRole, status: 0 | 1): Promise<boolean> => {
  const [result] = await db.execute<ResultSetHeader>(
    'UPDATE vueshop_admin SET role = ?, status = ? WHERE id = ?',
    [role, status, id]
  )
  return result.affectedRows > 0
}
