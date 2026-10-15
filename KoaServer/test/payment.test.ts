import './setup'
import assert from 'node:assert/strict'
import test from 'node:test'
import db from '../src/db'
import { create, succeed, validCallbackSignature, callbackSignature } from '../src/service/payment'

test('支付回调签名必须完整匹配', () => {
  const signature = callbackSignature('event-1', 'PAY12345678901234567890', '12.30')
  assert.equal(validCallbackSignature('event-1', 'PAY12345678901234567890', '12.30', signature), true)
  assert.equal(validCallbackSignature('event-1', 'PAY12345678901234567890', '12.31', signature), false)
})

test('创建支付单锁定所属订单并使用服务端金额', async context => {
  const future = new Date(Date.now() + 60_000)
  const events: string[] = []
  const connection = {
    async beginTransaction() { events.push('begin') },
    async execute(sql: string) {
      if (sql.includes('FROM vueshop_order\n')) return [[{ id: 9, order_no: 'O9', status: 'pending', total_amount: '12.30', payment_expires_at: future }], []]
      if (sql.includes('FROM vueshop_payment_order')) return [[], []]
      if (sql.includes('INSERT INTO vueshop_payment_order')) { events.push('insert-payment'); return [{ affectedRows: 1 }, []] }
      throw new Error(`unexpected SQL: ${sql}`)
    },
    async commit() { events.push('commit') }, async rollback() { events.push('rollback') }, release() { events.push('release') }
  }
  const queryMock = context.mock.method(db, 'execute', async () => [[], []])
  const connectionMock = context.mock.method(db, 'getConnection', async () => connection)
  const result = await create(7, 9)
  assert.equal(result.amount, 12.3)
  assert.equal(result.order_no, 'O9')
  assert.deepEqual(events, ['begin', 'insert-payment', 'commit', 'release'])
  queryMock.mock.restore(); connectionMock.mock.restore()
})

test('支付成功在同一事务记录事件并推进订单状态', async context => {
  const future = new Date(Date.now() + 60_000)
  const events: string[] = []
  const connection = {
    async beginTransaction() { events.push('begin') },
    async execute(sql: string) {
      if (sql.includes('SELECT p.*')) return [[{ id: 3, payment_no: 'PAY12345678901234567890', order_id: 9, order_no: 'O9', user_id: 7, provider: 'mock', amount: '12.30', status: 'pending', expires_at: future, paid_at: null }], []]
      if (sql.includes('INSERT IGNORE INTO vueshop_payment_callback')) { events.push('callback'); return [{ affectedRows: 1 }, []] }
      if (sql.includes("SET status = 'paid'")) { events.push('order-paid'); return [{ affectedRows: 1 }, []] }
      if (sql.includes("SET status = 'succeeded'")) { events.push('payment-paid'); return [{ affectedRows: 1 }, []] }
      throw new Error(`unexpected SQL: ${sql}`)
    },
    async commit() { events.push('commit') }, async rollback() { events.push('rollback') }, release() { events.push('release') }
  }
  const mocked = context.mock.method(db, 'getConnection', async () => connection)
  const result = await succeed('event-1', 'PAY12345678901234567890', '12.30')
  assert.equal(result.status, 'succeeded')
  assert.deepEqual(events, ['begin', 'callback', 'order-paid', 'payment-paid', 'commit', 'release'])
  mocked.mock.restore()
})
