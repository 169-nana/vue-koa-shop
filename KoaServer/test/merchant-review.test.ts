import assert from 'node:assert/strict'
import { test } from 'node:test'
import { adminOnly } from '../src/middleware/adminPermission'
import { isAuthIdentity } from '../src/utils/identity'
import { notificationText } from '../src/service/notification'

test('审核人员被后端权限中间件禁止执行管理员写操作', async () => {
  let reached = false
  const ctx = { state: { admin: { id: 2, type: 'admin', role: 'reviewer' } } } as Parameters<typeof adminOnly>[0]
  await adminOnly(ctx, async () => { reached = true })
  assert.equal(reached, false)
  assert.deepEqual(ctx.body, { errno: 1, data: null, errmsg: '审核人员没有执行该操作的权限' })
})

test('迁移前签发的管理员令牌仍可通过写操作权限中间件', async () => {
  let reached = false
  const ctx = { state: { admin: { id: 1, type: 'admin' } } } as Parameters<typeof adminOnly>[0]
  await adminOnly(ctx, async () => { reached = true })
  assert.equal(reached, true)
})

test('后台身份只接受明确的管理员或审核角色', () => {
  assert.equal(isAuthIdentity({ id: 1, type: 'admin', role: 'reviewer' }), true)
  assert.equal(isAuthIdentity({ id: 1, type: 'admin', role: 'stock_manager' }), false)
})

test('拒绝通知包含审核原因快照', () => {
  const notice = notificationText('goods_rejected', '测试商品', '原因：分类错误。补充说明：请重新选择')
  assert.equal(notice.title, '商品审核未通过')
  assert.match(notice.content, /测试商品/)
  assert.match(notice.content, /分类错误/)
})
