import './setup'
import assert from 'node:assert/strict'
import { test, type TestContext } from 'node:test'
import db from '../src/db'
import { enforce, preview, listReviewRecords, detail } from '../src/service/governance'
import { parseQuery, enforce as enforceController } from '../src/controller/governance'
import type { EnforcementInput } from '../../shared/api'

function fixture(context: TestContext, options: { role?: 'admin' | 'reviewer'; status?: string; fail?: string } = {}) {
  const merchant = { id: 3, user_id: 8, shop_name: '测试店铺', status: options.status ?? 'approved', contact_name: '店主', contact_phone: '13800138000', description: '', qualification_picture: 'uploads/test.png', version_id: 0 }
  const calls: Array<{ sql: string; values: unknown[] }> = []
  const lifecycle: string[] = []
  let nextId = 100
  context.mock.method(db, 'execute', async (sql: string) => sql.includes('AS goods_count') ? [[{ goods_count: 2, pending_count: 1 }], []] : [[{ ...merchant }], []])
  context.mock.method(db, 'getConnection', async () => ({
    async beginTransaction() { lifecycle.push('begin') },
    async execute(sql: string, values: unknown[] = []) {
      calls.push({ sql, values })
      if (options.fail && sql.includes(options.fail)) throw new Error('模拟写入失败')
      if (sql.includes('FROM vueshop_admin')) return [[{ username: 'operator', role: options.role ?? 'admin' }], []]
      if (sql.includes('FROM vueshop_merchant WHERE id')) return [[{ ...merchant }], []]
      if (sql.includes("action = 'suspend'")) return [[{ id: 50 }], []]
      if (sql.includes('SELECT * FROM vueshop_goods WHERE')) return [[
        { id: 10, name: '商品一', merchant_id: 3, sale_status: 'on_sale', compliance_status: 'normal', price: '10.00' },
        { id: 11, name: '商品二', merchant_id: 3, sale_status: 'off_sale', compliance_status: 'forced_off_sale', price: '20.00' }
      ], []]
      if (sql.includes('SELECT * FROM vueshop_goods_submission')) return [[{ id: 20, goods_id: 10, name: '整改商品', merchant_id: 3, status: 'pending' }], []]
      if (sql.includes('INSERT INTO vueshop_enforcement_record')) return [{ insertId: nextId++, affectedRows: 1 }, []]
      return [{ affectedRows: 1 }, []]
    },
    async commit() { lifecycle.push('commit') },
    async rollback() { lifecycle.push('rollback') },
    release() { lifecycle.push('release') }
  }))
  async function input(action: EnforcementInput['action'] = 'revoke'): Promise<EnforcementInput> {
    const current = await preview('merchant', 3)
    return { business_type: 'merchant', business_id: 3, action, expected_version: current.version, reason_ids: [], additional_note: '已核实违规材料', confirmation_name: merchant.shop_name }
  }
  return { merchant, calls, lifecycle, input }
}
const identity = { id: 1, type: 'admin' as const, role: 'admin' as const }

test('撤销资质关联所有商品与终止审核，保持金额快照和事务一致', async context => {
  const f = fixture(context)
  await enforce(identity, await f.input())
  const records = f.calls.filter(call => call.sql.includes('INSERT INTO vueshop_enforcement_record'))
  assert.equal(records.length, 3)
  assert.equal(records[0]?.values[14], null)
  assert.deepEqual(records.slice(1).map(call => call.values[14]), [100, 100])
  assert.match(String(records[1]?.values[10]), /"price":"10.00"/)
  const review = f.calls.find(call => call.sql.includes('INSERT INTO vueshop_review_record'))
  assert.ok(review)
  assert.match(review.sql, /'enforcement'/)
  assert.equal(review.values[10], 100)
  assert.ok(f.calls.some(call => call.sql.includes('INSERT INTO vueshop_notification')))
  assert.deepEqual(f.lifecycle, ['begin', 'commit', 'release'])
})

for (const fail of ['INSERT INTO vueshop_review_record', 'INSERT INTO vueshop_notification']) {
  test(`${fail} 失败会回滚处置与关联记录并释放连接`, async context => {
    const f = fixture(context, { fail })
    await assert.rejects(enforce(identity, await f.input()), /模拟写入失败/)
    assert.deepEqual(f.lifecycle, ['begin', 'rollback', 'release'])
  })
}

for (const action of ['revoke', 'restore'] as const) {
  test(`按数据库角色禁止审核人员执行 ${action}，不依赖令牌内旧权限`, async context => {
    const f = fixture(context, { role: 'reviewer', status: 'suspended' })
    await assert.rejects(enforce(identity, await f.input(action)), /仅管理员/)
    assert.equal(f.calls.some(call => /^\s*(UPDATE|INSERT)\b/.test(call.sql)), false)
    assert.deepEqual(f.lifecycle, ['begin', 'rollback', 'release'])
  })
}

test('审核人员可以暂停经营并关联商品，待审核申请保留', async context => {
  const f = fixture(context, { role: 'reviewer' })
  await enforce(identity, await f.input('suspend'))
  assert.equal(f.calls.filter(call => call.sql.includes('INSERT INTO vueshop_enforcement_record')).length, 3)
  assert.equal(f.calls.some(call => call.sql.includes('UPDATE vueshop_goods_submission')), false)
  assert.deepEqual(f.lifecycle, ['begin', 'commit', 'release'])
})

test('恢复经营关联原暂停记录，不自动上架商品，通知解释恢复范围', async context => {
  const f = fixture(context, { status: 'suspended' })
  await enforce(identity, await f.input('restore'))
  const record = f.calls.find(call => call.sql.includes('INSERT INTO vueshop_enforcement_record'))
  assert.equal(record?.values[14], 50)
  assert.equal(f.calls.some(call => call.sql.includes('UPDATE vueshop_goods')), false)
  assert.match(String(f.calls.find(call => call.sql.includes('INSERT INTO vueshop_notification'))?.values[3]), /商品仍需重新上架/)
})

test('恢复依据必填，撤销名称必须与锁内对象一致', async context => {
  const f = fixture(context, { status: 'suspended' })
  await assert.rejects(enforce(identity, { ...await f.input('restore'), additional_note: ' ' }), /恢复经营依据/)
  await assert.rejects(enforce(identity, { ...await f.input(), confirmation_name: '其他店铺' }), /完整店铺名称/)
  assert.equal(f.calls.some(call => /^\s*(UPDATE|INSERT)\b/.test(call.sql)), false)
})

test('过期对象与同状态的新版本都拒绝写入', async context => {
  const f = fixture(context)
  const input = await f.input()
  f.merchant.version_id++
  await assert.rejects(enforce(identity, input), /对象已发生变化/)
  assert.equal(f.calls.some(call => /^\s*(UPDATE|INSERT)\b/.test(call.sql)), false)
})

test('接口拒绝缺失版本和非法动作对象，不连接数据库', async () => {
  const ctx = { request: { body: { business_type: 'merchant', business_id: 3, action: 'revoke' } } } as Parameters<typeof enforceController>[0]
  await enforceController(ctx, async () => {})
  assert.equal(ctx.body?.errno, 1)
})

test('分页日期参数严格校验，不接受数组、越界和无效日期', () => {
  for (const query of [{ page: 0 }, { page_size: 101 }, { keyword: ['a'] }, { start_date: '2026-02-30' }, { start_date: '2026-09-09', end_date: '2026-09-08' }]) assert.throws(() => parseQuery(query))
  assert.deepEqual(parseQuery({ page: '2', page_size: '20', keyword: ' 商品 ' }), { page: 2, page_size: 20, keyword: '商品' })
})

test('列表筛选参数化，分页限定返回条数并提供总数', async context => {
  const calls: Array<{ sql: string; values: unknown[] }> = []
  context.mock.method(db, 'execute', async (sql: string, values: unknown[] = []) => {
    calls.push({ sql, values })
    return sql.startsWith('SELECT COUNT') ? [[{ total: 42 }], []] : [[], []]
  })
  const result = await listReviewRecords(parseQuery({ page: 2, keyword: "' OR 1=1 --", operator: '审核员', start_date: '2026-09-01', end_date: '2026-09-09' }))
  assert.equal(result.total, 42)
  assert.match(calls[1]?.sql ?? '', /LIMIT 20 OFFSET 20/)
  assert.doesNotMatch(calls[1]?.sql ?? '', /OR 1=1 --/)
  assert.ok(calls[1]?.values.includes("%' OR 1=1 --%"))
  assert.match(calls[1]?.sql ?? '', /DATE_ADD/)
})

test('详情保留历史快照，当前对象删除后仍能查看并追溯关联', async context => {
  context.mock.method(db, 'execute', async (sql: string) => {
    if (sql.includes('parent_record_id AS parent_id')) return [[{ id: 101, business_type: 'goods', business_id: 10, merchant_id: 3, business_snapshot: JSON.stringify({ name: '历史商品' }), parent_id: 100, source: 'enforcement', related_goods_id: null }], []]
    if (sql.includes('UNION ALL')) return [[{ id: 100, kind: 'records', name: '店铺', action: 'revoke' }], []]
    return [[], []]
  })
  const result = await detail('records', 101)
  assert.equal(result.snapshot?.name, '历史商品')
  assert.equal(result.current, null)
  assert.equal(result.parent_id, 100)
  assert.equal(result.related.length, 1)
})


test('处置参数拒绝隐式布尔数字、非法原因数组和动作对象错配', async () => {
  const base = { business_type: 'merchant', business_id: 3, action: 'revoke', reason_ids: [], additional_note: '说明', expected_version: 'a'.repeat(64) }
  for (const patch of [{ business_id: true }, { reason_ids: [true] }, { reason_ids: '1' }, { additional_note: {} }, { business_type: 'goods' }, { action: 'force_off_sale' }]) {
    const ctx = { request: { body: { ...base, ...patch } } } as Parameters<typeof enforceController>[0]
    await enforceController(ctx, async () => {})
    assert.equal(ctx.body?.errno, 1)
  }
})
