import { TEST_SECRET } from './setup'
import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import type { Server } from 'node:http'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import app from '../src/app'
import db from '../src/db'

let server: Server
let baseURL: string
const token = jwt.sign({ id: 7, type: 'admin' }, TEST_SECRET, { expiresIn: '5m' })

before(async () => {
  server = app.listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.once('listening', resolve))
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  baseURL = `http://127.0.0.1:${address.port}`
})
after(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  await db.end()
})
async function changePassword(body: unknown, jwtToken = token) {
  const response = await fetch(`${baseURL}/admin/admin/changePassword`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', jwt: jwtToken }, body: JSON.stringify(body)
  })
  const result: unknown = await response.json()
  assert.ok(result && typeof result === 'object' && 'errno' in result && 'errmsg' in result)
  return result
}

test('密码修改先鉴权并验证当前密码参数，不访问数据库', async context => {
  const execute = context.mock.method(db, 'execute', async () => { throw new Error('不应访问数据库') })
  try {
    assert.equal((await changePassword({ currentPassword: 'old123', password: 'new123' }, '')).errno, 2)
    for (const currentPassword of [undefined, null, {}, '', 'x'.repeat(73)]) {
      assert.equal((await changePassword({ currentPassword, password: 'new123' })).errno, 1)
    }
    for (const password of [null, 123456, '123', 'x'.repeat(13)]) {
      assert.equal((await changePassword({ currentPassword: 'old123', password })).errno, 1)
    }
    assert.equal(execute.mock.callCount(), 0)
  } finally { execute.mock.restore() }
})

test('当前密码错误、重复密码和账号不存在时不写入数据库', async context => {
  const hash = await bcrypt.hash('old123', 4)
  for (const scenario of ['wrong', 'same', 'missing']) {
    const execute = context.mock.method(db, 'execute', async (sql: string, params: unknown[]) => {
      assert.match(sql, /^SELECT/)
      assert.deepEqual(params, [7])
      return [scenario === 'missing' ? [] : [{ id: 7, username: 'test', avatar: '', password: hash }], []]
    })
    try {
      const result = await changePassword({ currentPassword: scenario === 'wrong' ? 'wrong123' : 'old123', password: scenario === 'same' ? 'old123' : 'new123' })
      assert.equal(result.errno, scenario === 'missing' ? 2 : 1)
      assert.equal(execute.mock.callCount(), 1)
    } finally { execute.mock.restore() }
  }
})

test('修改密码使用登录身份、加密存储并拒绝并发覆盖', async context => {
  const oldHash = await bcrypt.hash('old123', 4)
  for (const affectedRows of [1, 0]) {
    let writes = 0
    const execute = context.mock.method(db, 'execute', async (sql: string, params: unknown[]) => {
      if (sql.startsWith('SELECT')) {
        assert.deepEqual(params, [7])
        return [[{ id: 7, username: 'test', avatar: '', password: oldHash }], []]
      }
      writes++
      assert.match(sql, /WHERE id = \? AND password = \?/)
      assert.equal(params[1], 7)
      assert.equal(params[2], oldHash)
      assert.equal(typeof params[0], 'string')
      assert.ok(await bcrypt.compare('new123', String(params[0])))
      assert.notEqual(params[0], 'new123')
      return [{ affectedRows }, []]
    })
    try {
      const result = await changePassword({ id: 999, currentPassword: 'old123', password: 'new123' })
      assert.equal(result.errno, affectedRows ? 0 : 2)
      assert.equal(writes, 1)
    } finally { execute.mock.restore() }
  }
})
