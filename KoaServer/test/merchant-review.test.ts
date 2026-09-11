import assert from 'node:assert/strict'
import { test } from 'node:test'
import { adminOnly } from '../src/middleware/adminPermission'
import { isAuthIdentity } from '../src/utils/identity'
import { notificationText } from '../src/service/notification'
import db from '../src/db'
import { reviewGoods } from '../src/service/moderation'
import { enforce, preview } from '../src/service/governance'
import merchantAuth from '../src/middleware/merchantAuth'
import { submitApplication } from '../src/service/merchant'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { projectRoot } from '../src/utils/paths'

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

test('批准新商品时立即写入上架状态', async context => {
  let insertedGoodsSQL = ''
  const connection = {
    async beginTransaction() {},
    async execute(sql: string) {
      if (sql.includes('FROM vueshop_goods_submission AS s')) {
        return [[{
          id: 9,
          goods_id: null,
          merchant_id: 3,
          user_id: 5,
          name: '待审核商品',
          category_id: 2,
          price: '19.90',
          stock: 8,
          picture: 'uploads/goods.png',
          spec: '默认规格',
          description: '商品介绍',
          status: 'pending',
          action: 'create',
          submitted_at: '2026-09-09 10:00:00',
          merchant_status: 'approved'
        }], []]
      }
      if (sql.includes('INSERT INTO vueshop_goods') && !sql.includes('vueshop_goods_album')) {
        insertedGoodsSQL = sql
        return [{ insertId: 77 }, []]
      }
      if (sql.includes('SELECT picture FROM vueshop_goods_submission_album')) return [[], []]
      return [{ affectedRows: 1 }, []]
    },
    async commit() {},
    async rollback() {},
    release() {}
  }
  const mocked = context.mock.method(db, 'getConnection', async () => connection)
  assert.equal(await reviewGoods(2, {
    id: 9,
    decision: 'approved',
    reason_ids: [],
    additional_note: ''
  }), 77)
  assert.match(insertedGoodsSQL, /'on_sale'/)
  assert.doesNotMatch(insertedGoodsSQL, /'off_sale'/)
  mocked.mock.restore()
})

test('商家操作按用户和显式店铺ID鉴权', async context => {
  let nextCalled = false
  const mocked = context.mock.method(db, 'execute', async (sql: string, values?: unknown[]) => {
    assert.match(sql, /id = \? AND user_id = \? AND status = 'approved'/)
    assert.deepEqual(values, [8, 3])
    return [[{ id: 8, user_id: 3, shop_name: '第二店铺', status: 'approved' }], []]
  })
  const ctx = {
    state: { user: { id: 3, username: 'merchant', avatar: '', status: 1 } },
    query: { merchant_id: '8' }
  } as unknown as Parameters<typeof merchantAuth>[0]
  await merchantAuth(ctx, async () => { nextCalled = true })
  assert.equal(nextCalled, true)
  assert.equal(ctx.state.merchant?.id, 8)
  mocked.mock.restore()
})

test('同一用户可以连续创建不同店铺申请', async context => {
  let nextId = 20
  const userIds: number[] = []
  const mocked = context.mock.method(db, 'execute', async (_sql: string, values?: unknown[]) => {
    if (typeof values?.[0] === 'number') userIds.push(values[0])
    return [{ insertId: nextId++ }, []]
  })
  const base = {
    contact_name: '联系人', contact_phone: '13800138000', description: '',
    qualification_picture: 'uploads/qualification.png'
  }
  assert.equal(await submitApplication(6, { ...base, shop_name: '店铺一' }), 20)
  assert.equal(await submitApplication(6, { ...base, shop_name: '店铺二' }), 21)
  assert.deepEqual(userIds, [6, 6])
  mocked.mock.restore()
})

test('多店铺迁移移除用户唯一索引', () => {
  const sql = readFileSync(path.join(projectRoot, 'sql/006_allow_multiple_merchant_shops.sql'), 'utf8')
  assert.match(sql, /DROP INDEX uk_merchant_user/i)
})

test('违规处置迁移包含合规状态、审核快照和独立处置记录', () => {
  const sql = readFileSync(path.join(projectRoot, 'sql/007_create_compliance_governance.sql'), 'utf8')
  assert.match(sql, /compliance_status/i)
  assert.match(sql, /business_snapshot/i)
  assert.match(sql, /CREATE TABLE IF NOT EXISTS vueshop_enforcement_record/i)
  assert.match(sql, /merchant_revoked|goods_enforcement/i)
})

test('平台强制下架商品时同时留痕并发送通知', async context => {
  const fixture = {
        id: 12, merchant_id: 3, user_id: 8, merchant_name: '测试店铺', name: '违规商品',
        sale_status: 'on_sale', compliance_status: 'normal', category_id: 2, price: '19.90',
        stock: 3, picture: 'goods.png', spec: '', description: '', version_id: 0
      }
  const statements: string[] = []
  const connection = {
    async beginTransaction() {},
    async execute(sql: string) {
      statements.push(sql)
      if (sql.includes('FROM vueshop_admin')) return [[{ username: 'reviewer01', role: 'reviewer' }], []]
      if (sql.includes('FROM vueshop_goods AS g INNER JOIN vueshop_merchant')) return [[fixture], []]
      if (sql.includes('FROM vueshop_rejection_reason')) return [[{ id: 1, label: '商品描述与实际不符' }], []]
      return [{ affectedRows: 1 }, []]
    },
    async commit() {}, async rollback() {}, release() {}
  }
  const mocked = context.mock.method(db, 'getConnection', async () => connection)
  context.mock.method(db, 'execute', async (sql: string) => sql.includes('AS goods_count') ? [[{ goods_count: 1, pending_count: 0 }], []] : [[fixture], []])
  const target = await preview('goods', 12)
  await enforce({ id: 2, type: 'admin', role: 'reviewer' }, {
    expected_version: target.version, business_type: 'goods', business_id: 12, action: 'force_off_sale', reason_ids: [1], additional_note: ''
  })
  assert.ok(statements.some(sql => /compliance_status = 'forced_off_sale'/.test(sql)))
  assert.ok(statements.some(sql => /INSERT INTO vueshop_enforcement_record/.test(sql)))
  assert.ok(statements.some(sql => /INSERT INTO vueshop_notification/.test(sql)))
  mocked.mock.restore()
})
