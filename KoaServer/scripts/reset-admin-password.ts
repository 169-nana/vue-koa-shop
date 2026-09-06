import type { ResultSetHeader } from 'mysql2/promise'
//创建一次性密码初始化脚本
import bcrypt from 'bcryptjs'
import db from '../src/db'

async function main() {
  const username = process.argv[2]
  const password = process.argv[3]

  if (!username || !password) {
    console.log(
      '用法：npm run reset-admin-password -- 用户名 新密码'
    )
    process.exitCode = 1
    return
  }

  // 12是计算成本，数值越大越安全，但计算越慢
  const passwordHash = await bcrypt.hash(password, 12)

  const sql = `
    UPDATE vueshop_admin
    SET password = ?
    WHERE username = ?
  `

  const [result] = await db.execute<ResultSetHeader>(sql, [
    passwordHash,
    username
  ])

  if (result.affectedRows === 0) {
    throw new Error(`管理员 ${username} 不存在`)
  }

  console.log(`管理员 ${username} 的密码已更新`)
}

main()
  .catch(error => {
    console.error('密码更新失败：', error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await db.end()
  })