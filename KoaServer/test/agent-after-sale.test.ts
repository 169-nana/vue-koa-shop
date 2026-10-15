import assert from 'node:assert/strict'
import test from 'node:test'

import db from '../src/db'
import { getAfterSaleEligibility } from '../src/service/agentAfterSaleAction'
import { createFromAgent, decide } from '../src/service/refund'
import {
  executeSupportTicket,
  prepareSupportTicket
} from '../src/service/agentSupportTicket'

test('售后资格只使用当前用户订单商品并由服务器计算退款上限', async context => {
  const mocked = context.mock.method(db, 'execute', async (sql: string) => {
    if (sql.includes('FROM vueshop_order AS o')) {
      return [[{
        order_id: 9,
        order_no: 'ORDER-9',
        order_status: 'paid',
        order_item_id: 21,
        goods_name: '测试商品',
        goods_spec: '蓝色',
        unit_price: '12.50',
        purchased_quantity: 3,
        application_id: null
      }], []]
    }
    if (sql.includes('vueshop_agent_conversion_event')) return [{ affectedRows: 1 }, []]
    throw new Error(`unexpected SQL: ${sql}`)
  })

  const result = await getAfterSaleEligibility(7, 9, 21, 2)
  assert.equal(result.eligible, true)
  assert.equal(result.item?.max_refund_amount, 25)
  assert.equal(result.item?.requested_quantity, 2)
  mocked.mock.restore()
})

test('智能体售后提交在事务内重新验证状态、数量、重复申请和金额', async context => {
  const events: string[] = []
  const connection = {
    async beginTransaction() { events.push('begin') },
    async execute(sql: string, values?: unknown[]) {
      if (sql.includes('FROM vueshop_order AS o')) {
        events.push('lock-item')
        return [[{
          order_id: 9, order_no: 'ORDER-9', status: 'paid', order_item_id: 21,
          goods_name: '测试商品', goods_spec: '蓝色', unit_price: '12.50',
          purchased_quantity: 3
        }], []]
      }
      if (sql.includes('SELECT id FROM vueshop_order_refund')) {
        events.push('check-duplicate')
        return [[], []]
      }
      if (sql.includes('INSERT INTO vueshop_order_refund')) {
        events.push('insert')
        assert.equal(values?.[5], 'item:21')
        assert.equal(values?.[6], '25.00')
        return [{ insertId: 33 }, []]
      }
      throw new Error(`unexpected SQL: ${sql}`)
    },
    async commit() { events.push('commit') },
    async rollback() { events.push('rollback') },
    release() { events.push('release') }
  }
  const mocked = context.mock.method(db, 'getConnection', async () => connection)

  assert.equal(await createFromAgent(7, 9, 21, 2, 'return_refund', '商品破损需要退货'), 33)
  assert.deepEqual(events, ['begin', 'lock-item', 'check-duplicate', 'insert', 'commit', 'release'])
  mocked.mock.restore()
})

test('后台只能处理仍处于待审核状态的售后申请', async context => {
  const connection = {
    async beginTransaction() {},
    async execute() { return [[], []] },
    async commit() {}, async rollback() {}, release() {}
  }
  const mocked = context.mock.method(db, 'getConnection', async () => connection)
  await assert.rejects(
    decide(3, 1, { id: 3, decision: 'approved', note: '审核通过' }),
    /已经处理/
  )
  mocked.mock.restore()
})

test('人工客服工单必须经过一次性确认后才会创建', async context => {
  let storedPayload = ''
  let claimed = false
  const events: string[] = []
  const mocked = context.mock.method(db, 'execute', async (sql: string, values?: unknown[]) => {
    if (sql.includes('INSERT INTO vueshop_agent_action')) {
      storedPayload = String(values?.[4] ?? '')
      events.push('prepared')
      return [{ affectedRows: 1 }, []]
    }
    if (sql.includes("SET status = 'executing'")) {
      const affectedRows = claimed ? 0 : 1
      claimed = true
      events.push('claimed')
      return [{ affectedRows }, []]
    }
    if (sql.includes('SELECT payload')) return [[{ payload: storedPayload }], []]
    if (sql.includes('INSERT INTO vueshop_agent_support_ticket')) {
      events.push('created')
      return [{ insertId: 18 }, []]
    }
    if (sql.includes("SET status = 'succeeded'")) {
      events.push('succeeded')
      return [{ affectedRows: 1 }, []]
    }
    if (sql.includes('vueshop_agent_conversion_event')) return [{ affectedRows: 1 }, []]
    throw new Error(`unexpected SQL: ${sql}`)
  })

  const pending = await prepareSupportTicket(7, {
    orderId: null,
    subject: '需要人工协助',
    summary: '商品问题无法通过自助方式解决'
  })
  const result = await executeSupportTicket(7, pending.token)
  assert.equal(result.ticket_id, 18)
  await assert.rejects(executeSupportTicket(7, pending.token), /已执行或已过期/)
  assert.deepEqual(events, ['prepared', 'claimed', 'created', 'succeeded', 'claimed'])
  mocked.mock.restore()
})
