import bcrypt from 'bcryptjs'
import type { ResultSetHeader } from 'mysql2/promise'
import db from '../src/db'

async function main(): Promise<void> {
  const username = process.argv[2]
  const password = process.argv[3]
  if (!username || !/^[a-zA-Z0-9_]{3,20}$/.test(username) || !password || password.length < 8 || password.length > 72) {
    throw new Error('用法：npm run init-admin -- 用户名 8到72位密码')
  }
  const passwordHash = await bcrypt.hash(password, 12)
  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO vueshop_admin (username, password, avatar, role, status)
     VALUES (?, ?, '', 'admin', 1)`,
    [username, passwordHash]
  )
  console.log(`管理员已创建，ID：${result.insertId}`)
}

main().catch(error => {
  console.error('管理员初始化失败：', error instanceof Error ? error.message : error)
  process.exitCode = 1
}).finally(() => db.end())
