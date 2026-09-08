import type { PublicAdmin } from '../../../shared/api'
import type { ResultSetHeader } from 'mysql2/promise'
import type { AdminRow, AdminPasswordRow } from '../db/types'
//负责查询数据，组织业务数据
import db from '../db/index'

//根据用户名查询管理员
export const findByUsername = async (username: string): Promise<(PublicAdmin & { password: string }) | null> => {
  //不能将用户传入的参数直接拼接到sql语句，利用？占位符防止SQL注入
  const sql = `
    SELECT id, username, password, avatar
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
    SELECT id, username, avatar
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
    'SELECT id, username, password, avatar FROM vueshop_admin WHERE id = ? LIMIT 1', [id]
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
