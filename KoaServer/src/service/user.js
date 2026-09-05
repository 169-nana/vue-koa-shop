const db = require('../db')

// 根据用户名查询用户
exports.findByUsername = async username => {
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

  const [rows] = await db.execute(sql, [
    username
  ])

  return rows[0] || null
}

// 根据ID查询用户公开信息
exports.findById = async id => {
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

  const [rows] = await db.execute(sql, [id])

  return rows[0] || null
}

// 创建用户
exports.create = async ({
  username,
  passwordHash
}) => {
  const sql = `
    INSERT INTO vueshop_user (
      username,
      password,
      avatar,
      status
    )
    VALUES (?, ?, '', 1)
  `

  const [result] = await db.execute(sql, [
    username,
    passwordHash
  ])

  return result.insertId
}