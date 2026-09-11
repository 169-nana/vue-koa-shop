import assert from 'node:assert/strict'
import test from 'node:test'

import { checkAgentRateLimit } from '../src/middleware/agentRateLimit'
import { searchFallbackKnowledge } from '../src/service/agentKnowledge'

test('顾客智能体在一分钟窗口内限制第13次请求', () => {
  const key = `test:${Math.random()}`
  const now = 1_000

  for (let index = 0; index < 12; index++) {
    assert.equal(checkAgentRateLimit(key, now).allowed, true)
  }

  const blocked = checkAgentRateLimit(key, now)
  assert.equal(blocked.allowed, false)
  assert.equal(blocked.retryAfterSeconds, 60)
  assert.equal(checkAgentRateLimit(key, now + 60_000).allowed, true)
})

test('本地知识库能匹配配送和售后问题', () => {
  assert.equal(searchFallbackKnowledge('运费怎么算')[0]?.category, 'delivery')
  assert.equal(searchFallbackKnowledge('退款多久到账')[0]?.category, 'refund')
})
