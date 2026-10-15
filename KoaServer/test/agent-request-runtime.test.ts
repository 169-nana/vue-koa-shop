import assert from 'node:assert/strict'
import test from 'node:test'

import {
  cancelAgentRequest,
  registerAgentRequest,
  unregisterAgentRequest
} from '../src/service/agentRequestRuntime'

test('进行中的智能体请求只能由所属用户取消', () => {
  const controller = registerAgentRequest('request-owned', 7)
  assert.equal(cancelAgentRequest('request-owned', 8), false)
  assert.equal(controller.signal.aborted, false)
  assert.equal(cancelAgentRequest('request-owned', 7), true)
  assert.equal(controller.signal.aborted, true)
  assert.equal(cancelAgentRequest('request-owned', 7), false)
})

test('请求结束注销后不能再被取消', () => {
  const controller = registerAgentRequest('request-finished', 7)
  unregisterAgentRequest('request-finished')
  assert.equal(cancelAgentRequest('request-finished', 7), false)
  assert.equal(controller.signal.aborted, false)
})
