import assert from 'node:assert/strict'
import test from 'node:test'

import db from '../src/db'
import {
  conversationTitle,
  deleteAgentConversation,
  pruneExpiredAgentHistory,
  referencedProducts
} from '../src/service/agentConversation'

test('会话标题压缩空白并限制长度', () => {
  assert.equal(conversationTitle('  推荐   一些耳机  '), '推荐 一些耳机')
  assert.equal(conversationTitle('这是一个明显超过二十四个字符并且应当被安全截断的会话标题内容').endsWith('…'), true)
})

test('结构化上下文保留商品顺序并限制为八项', () => {
  const products = Array.from({ length: 10 }, (_, index) => ({
    id: index + 1,
    name: `商品${index + 1}`,
    category_id: 1,
    price: 10,
    stock: 5,
    picture: '',
    spec: '默认',
    description: ''
  }))
  assert.deepEqual(
    referencedProducts(products).products.map(product => product.id),
    [1, 2, 3, 4, 5, 6, 7, 8]
  )
})

test('删除会话和所属消息使用同一事务及当前用户条件', async context => {
  const events: string[] = []
  const connection = {
    async beginTransaction() { events.push('begin') },
    async execute(sql: string, values: number[]) {
      assert.deepEqual(values, [42, 7])
      if (sql.includes('vueshop_agent_conversation')) {
        events.push('delete-conversation')
        return [{ affectedRows: 1 }, []]
      }
      events.push('delete-messages')
      return [{ affectedRows: 4 }, []]
    },
    async commit() { events.push('commit') },
    async rollback() { events.push('rollback') },
    release() { events.push('release') }
  }
  const mocked = context.mock.method(db, 'getConnection', async () => connection)

  await deleteAgentConversation(7, 42)
  assert.deepEqual(events, [
    'begin', 'delete-conversation', 'delete-messages', 'commit', 'release'
  ])
  mocked.mock.restore()
})

test('过期聊天记录按当前用户清理且保留仍有消息的会话', async context => {
  let calls = 0
  const mocked = context.mock.method(db, 'execute', async (sql: string, values: number[]) => {
    calls += 1
    assert.deepEqual(values, [7])
    assert.match(sql, /INTERVAL 90 DAY/)
    if (sql.includes('DELETE conversation')) assert.match(sql, /message\.id IS NULL/)
    return [{ affectedRows: 0 }, []]
  })

  await pruneExpiredAgentHistory(7)
  assert.equal(calls, 2)
  mocked.mock.restore()
})
