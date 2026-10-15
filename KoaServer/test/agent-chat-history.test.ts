import assert from 'node:assert/strict'
import test from 'node:test'

import db from '../src/db'
import {
  clearAgentChatHistory,
  getAgentChatHistory,
  saveAgentExchange
} from '../src/service/agentChatHistory'

test('聊天历史按用户和向前游标分页，并以时间正序返回', async context => {
  const mocked = context.mock.method(
    db,
    'execute',
    async (sql: string, values: number[]) => {
      assert.match(sql, /WHERE message\.user_id = \? AND message\.conversation_id = \? AND message\.id < \?/)
      assert.match(sql, /ORDER BY message\.id DESC/)
      assert.deepEqual(values, [7, 42, 101, 3])
      return [[
        { id: 100, request_id: 'r-100', role: 'assistant', content: '回答2', created_at: new Date('2026-09-12T02:00:00Z') },
        { id: 99, request_id: 'r-099', role: 'user', content: '问题2', created_at: new Date('2026-09-12T01:59:00Z') },
        { id: 98, request_id: 'r-098', role: 'assistant', content: '更早记录', created_at: new Date('2026-09-12T01:00:00Z') }
      ], []]
    }
  )

  const page = await getAgentChatHistory(7, 42, 101, 2)
  assert.equal(page.hasMore, true)
  assert.equal(page.nextBeforeId, 99)
  assert.deepEqual(page.list.map(message => message.id), [99, 100])
  assert.equal(page.list[0]?.created_at, '2026-09-12T01:59:00.000Z')
  mocked.mock.restore()
})

test('一轮成功对话在同一事务内保存用户消息和助手消息', async context => {
  const events: string[] = []
  const connection = {
    async beginTransaction() { events.push('begin') },
    async execute(sql: string, values: Array<string | number>) {
      if (sql.includes('FOR UPDATE')) {
        assert.deepEqual(values, [42, 7])
        events.push('lock-conversation')
        return [[{ id: 42, revision: 3 }], []]
      }
      if (sql.includes('INSERT INTO vueshop_agent_chat_message')) {
        assert.deepEqual(values, [7, 42, 'request-1', '问题', 7, 42, 'request-1', '回答'])
        events.push('insert')
        return [{ affectedRows: 2 }, []]
      }
      assert.match(sql, /UPDATE vueshop_agent_conversation/)
      assert.deepEqual(values, ['问题', null, 42, 7])
      events.push('update-conversation')
      return [{ affectedRows: 1 }, []]
    },
    async commit() { events.push('commit') },
    async rollback() { events.push('rollback') },
    release() { events.push('release') }
  }
  const mocked = context.mock.method(db, 'getConnection', async () => connection)

  await saveAgentExchange(7, 42, 'request-1', '问题', '回答', { products: [] }, 3)
  assert.deepEqual(events, ['begin', 'lock-conversation', 'insert', 'update-conversation', 'commit', 'release'])
  mocked.mock.restore()
})

test('清空聊天记录只删除当前登录用户的数据', async context => {
  const events: string[] = []
  const connection = {
    async beginTransaction() { events.push('begin') },
    async execute(sql: string, values: number[]) {
      if (sql.includes('UPDATE vueshop_agent_conversation')) {
        assert.deepEqual(values, [42, 7])
        assert.match(sql, /revision = revision \+ 1/)
        events.push('bump-revision')
        return [{ affectedRows: 1 }, []]
      }
      assert.deepEqual(values, [7, 42])
      assert.match(sql, /DELETE FROM vueshop_agent_chat_message/)
      events.push('delete-messages')
      return [{ affectedRows: 4 }, []]
    },
    async commit() { events.push('commit') },
    async rollback() { events.push('rollback') },
    release() { events.push('release') }
  }
  const mocked = context.mock.method(db, 'getConnection', async () => connection)

  await clearAgentChatHistory(7, 42)
  assert.deepEqual(events, ['begin', 'bump-revision', 'delete-messages', 'commit', 'release'])
  mocked.mock.restore()
})

test('较早请求在会话版本变化后不能回写历史', async context => {
  const events: string[] = []
  const connection = {
    async beginTransaction() { events.push('begin') },
    async execute(sql: string) {
      assert.match(sql, /FOR UPDATE/)
      return [[{ id: 42, revision: 4 }], []]
    },
    async commit() { events.push('commit') },
    async rollback() { events.push('rollback') },
    release() { events.push('release') }
  }
  const mocked = context.mock.method(db, 'getConnection', async () => connection)
  await assert.rejects(
    saveAgentExchange(7, 42, 'request-old', '旧问题', '旧回答', { products: [] }, 3),
    /忽略较早的回复/
  )
  assert.deepEqual(events, ['begin', 'rollback', 'release'])
  mocked.mock.restore()
})

test('未过期确认动作能随历史恢复，过期动作只恢复状态', async context => {
  const future = new Date(Date.now() + 60_000)
  const past = new Date(Date.now() - 60_000)
  const mocked = context.mock.method(db, 'execute', async () => [[
    {
      id: 1, user_id: 7, request_id: 'request-prepared', role: 'assistant', content: '请确认',
      created_at: new Date(), action_id: 'action-prepared', action_type: 'add_to_cart',
      action_status: 'prepared', action_title: '加入购物车', action_description: '数量 1',
      action_expires_at: future
    },
    {
      id: 2, user_id: 7, request_id: 'request-expired', role: 'assistant', content: '请确认',
      created_at: new Date(), action_id: 'action-expired', action_type: 'apply_after_sale',
      action_status: 'prepared', action_title: '申请售后', action_description: '商品破损',
      action_expires_at: past
    }
  ], []])

  const page = await getAgentChatHistory(7, 42, null, 20)
  const expired = page.list[0]?.action
  const prepared = page.list[1]?.action
  assert.equal(expired?.status, 'expired')
  assert.equal(expired?.token, undefined)
  assert.equal(prepared?.status, 'prepared')
  assert.equal(typeof prepared?.token, 'string')
  mocked.mock.restore()
})
