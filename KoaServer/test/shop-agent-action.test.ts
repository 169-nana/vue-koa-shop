import assert from 'node:assert/strict'
import test from 'node:test'

import db from '../src/db'
import * as addressService from '../src/service/address'
import {
  executeAddToCart,
  prepareAddToCart
} from '../src/service/agentCartAction'
import * as cartService from '../src/service/cart'
import * as goodsService from '../src/service/goods'

test('智能加购必须先准备确认，再以一次性动作执行现有购物车服务', async context => {
  const events: string[] = []
  let storedPayload = ''
  let claimCount = 0

  context.mock.method(goodsService, 'findPublicById', async () => ({
    id: 16,
    category_id: 2,
    name: '测试耳机',
    price: 99,
    picture: 'uploads/test.png',
    stock: 8,
    spec: 'red,blue',
    description: '测试商品',
    merchant_name: null
  }))
  context.mock.method(addressService, 'findByUserId', async () => [{
    id: 5,
    receiver_name: '测试用户',
    receiver_phone: '13800138000',
    receiver_address: '测试地址',
    is_default: true
  }])
  context.mock.method(cartService, 'add', async (
    userId: number,
    goodsId: number,
    quantity: number,
    selectedSpec: string,
    addressId: number
  ) => {
    events.push(`cart:${userId}:${goodsId}:${quantity}:${selectedSpec}:${addressId}`)
  })
  context.mock.method(db, 'execute', async (sql: string, values?: unknown[]) => {
    if (sql.includes('INSERT INTO vueshop_agent_action')) {
      storedPayload = String(values?.[2] ?? '')
      events.push('prepared')
      return [{ affectedRows: 1 }, []]
    }
    if (sql.includes("SET status = 'executing'")) {
      claimCount += 1
      events.push('claimed')
      return [{ affectedRows: claimCount === 1 ? 1 : 0 }, []]
    }
    if (sql.includes('SELECT id, payload')) {
      return [[{ id: 'action', payload: storedPayload }], []]
    }
    if (sql.includes("SET status = 'succeeded'")) {
      events.push('succeeded')
      return [{ affectedRows: 1 }, []]
    }
    if (sql.includes('vueshop_agent_conversion_event')) {
      return [{ affectedRows: 1 }, []]
    }
    throw new Error(`unexpected SQL: ${sql}`)
  })

  const pending = await prepareAddToCart(7, 16, 2, 'red')
  assert.match(pending.title, /测试耳机/)
  assert.match(pending.description, /red.*2/)

  const result = await executeAddToCart(7, pending.token)
  assert.deepEqual(result, { message: '商品已加入购物车', cart_path: '/cart' })
  await assert.rejects(executeAddToCart(7, pending.token), /已执行或已过期/)
  assert.deepEqual(events, [
    'prepared',
    'claimed',
    'cart:7:16:2:red:5',
    'succeeded',
    'claimed'
  ])
})
