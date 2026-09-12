import assert from 'node:assert/strict'
import test from 'node:test'

import db from '../src/db'
import { hashAgentRequestKey } from '../src/service/agentObservability'
import { getMetrics, publishPrompt, saveFeedback } from '../src/service/agentOperations'

test('运营看板按与展示日期相同的表达式分组，兼容 ONLY_FULL_GROUP_BY', async context => {
  let calls = 0
  const mocked = context.mock.method(db, 'execute', async (sql: string) => {
    calls += 1
    if (sql.includes('AS average_duration_ms') && !sql.includes('DATE_FORMAT')) {
      return [[{ calls: 0, successes: 0, average_duration_ms: 0, recommended_products: 0 }], []]
    }
    if (sql.includes('DATE_FORMAT')) {
      assert.match(sql, /GROUP BY DATE_FORMAT\(created_at, '%Y-%m-%d'\)/)
    }
    return [[], []]
  })

  const metrics = await getMetrics(7)
  assert.equal(metrics.calls, 0)
  assert.equal(calls, 6)
  mocked.mock.restore()
})

test('回答反馈只能由产生该回答的用户或游客会话提交', async context => {
  const ownerKey = 'user:7'
  const requestId = '00000000-0000-4000-8000-000000000001'
  let inserts = 0
  const mocked = context.mock.method(db, 'execute', async (sql: string) => {
    if (sql.includes('SELECT request_key_hash')) {
      return [[{ request_key_hash: hashAgentRequestKey(ownerKey), user_id: 7 }], []]
    }
    inserts += 1
    return [{ affectedRows: 1 }, []]
  })

  await assert.rejects(
    saveFeedback({ request_id: requestId, rating: 'helpful' }, 8, 'user:8'),
    /无权评价/
  )
  assert.equal(inserts, 0)

  await saveFeedback({ request_id: requestId, rating: 'helpful' }, 7, ownerKey)
  assert.equal(inserts, 1)
  mocked.mock.restore()
})

test('Prompt 未达到75分不能发布，达到门槛后归档旧版本并发布新版本', async context => {
  for (const score of ['74.99', '75.00']) {
    const events: string[] = []
    const connection = {
      async beginTransaction() { events.push('begin') },
      async execute(sql: string) {
        if (sql.includes('SELECT eval_score')) {
          events.push('select')
          return [[{ eval_score: score }], []]
        }
        if (sql.includes("SET status = 'archived'")) events.push('archive')
        if (sql.includes("SET status = 'published'")) events.push('publish')
        return [{ affectedRows: 1 }, []]
      },
      async commit() { events.push('commit') },
      async rollback() { events.push('rollback') },
      release() { events.push('release') }
    }
    const mocked = context.mock.method(db, 'getConnection', async () => connection)

    if (score === '74.99') {
      await assert.rejects(publishPrompt(2, 1), /达到75分/)
      assert.deepEqual(events, ['begin', 'select', 'rollback', 'release'])
    } else {
      await publishPrompt(2, 1)
      assert.deepEqual(events, ['begin', 'select', 'archive', 'publish', 'commit', 'release'])
    }
    mocked.mock.restore()
  }
})
