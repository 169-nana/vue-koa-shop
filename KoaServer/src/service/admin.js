//负责查询数据，组织业务数据
const db = require('../db/index')

//根据用户名查询管理员
exports.findByUsername = async username => {
  //不能将用户传入的参数直接拼接到sql语句，利用？占位符防止SQL注入
  const sql = `
    SELECT id, username, password, avatar
    FROM vueshop_admin
    WHERE username = ?
    LIMIT 1
  `

  //mysql2模块的execute()方法会返回一个数组，第一个元素是查询结果，第二个元素是字段信息[rows, fields]
  //db.execute()会将[username]传入到？占位符中，防止SQL注入
  const [rows] = await db.execute(sql, [username])

  return rows[0] || null
}

// 根据ID查询管理员公开信息
exports.findById = async id => {
  const sql = `
    SELECT id, username, avatar
    FROM vueshop_admin
    WHERE id = ?
    LIMIT 1
  `

  const [rows] = await db.execute(sql, [id])

  return rows[0] || null
}

// 修改管理员密码
exports.updatePassword = async (
  id,
  passwordHash
) => {
  const sql = `
    UPDATE vueshop_admin
    SET password = ?
    WHERE id = ?
  `

  const [result] = await db.execute(sql, [
    passwordHash,
    id
  ])

  return result.affectedRows
}

// 修改管理员头像
exports.updateAvatar = async (
  id,
  avatar
) => {
  const sql = `
    UPDATE vueshop_admin
    SET avatar = ?
    WHERE id = ?
  `

  const [result] = await db.execute(sql, [
    avatar,
    id
  ])

  return result.affectedRows
}