import { TEST_SECRET } from './setup'
import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import type { Server } from 'node:http'
import jwt from 'jsonwebtoken'
import { getAlbumPaths } from '../../shared/upload'
import { unwrapResponse } from '../../shared/response'
import app from '../src/app'
import db from '../src/db'
import { createWithAlbum } from '../src/service/goods'
import { create as createOrder } from '../src/service/order'

let server: Server
let baseURL: string
let adminToken: string

before(async () => {
  server = app.listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.once('listening', resolve))
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  baseURL = `http://127.0.0.1:${address.port}`
  adminToken = jwt.sign({ id: 1, type: 'admin' }, TEST_SECRET, { expiresIn: '1m' })
})

after(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  await db.end()
})

async function request(path: string, body?: unknown, token?: string) {
  const response = await fetch(baseURL + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { jwt: token } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  })
  const data: unknown = await response.json()
  assert.ok(typeof data === 'object' && data !== null && 'errno' in data && 'errmsg' in data)
  return { status: response.status, ...data }
}

test('未登录的商品请求与上传请求仍然先被鉴权拦截', async () => {
  assert.equal((await request('/admin/goods/list')).errno, 2)
  assert.equal((await request('/admin/upload/picture', {})).errno, 2)
  assert.equal((await request('/home/cart')).errno, 2)
  assert.equal((await request('/home/order/list')).errno, 2)
  assert.equal((await request('/home/address/list')).errno, 2)
  assert.equal((await request('/home/user/dashboard')).errno, 2)
  assert.equal((await request('/home/user/avatar', { avatar: 'uploads/test.png' })).errno, 2)
  assert.equal((await request('/home/refund/list')).errno, 2)
  assert.equal((await request('/home/review/reviewable')).errno, 2)
})

test('无效、过期和身份不符的 JWT 被拒绝', async () => {
  const secret = TEST_SECRET
  for (const token of [
    'invalid',
    jwt.sign({ id: 1, type: 'admin' }, secret, { expiresIn: -1 }),
    jwt.sign({ id: 1, type: 'user' }, secret),
    jwt.sign({ id: '1', type: 'admin' }, secret)
  ]) assert.equal((await request('/admin/goods/list', undefined, token)).errno, 2)
  assert.equal((await request('/home/user', undefined, adminToken)).errno, 2)
})

test('合法管理员 JWT 可到达参数校验，查询区间错误被拒绝', async () => {
  const result = await request('/admin/goods/list?min_price=20&max_price=10', undefined, adminToken)
  assert.equal(result.errno, 1)
  assert.equal(result.errmsg, '最低价格不能高于最高价格')
  assert.equal((await request('/admin/goods/list?page=0', undefined, adminToken)).errno, 1)
})

test('商品金额、库存及分类 ID 保持运行时校验', async () => {
  const goods = { name: '测试商品', category_id: 1, price: '1.234', stock: 1, picture: 'uploads/test.png', album: [], spec: '', description: '' }
  assert.equal((await request('/admin/goods/add', goods, adminToken)).errmsg, '商品价格必须是有效的非负金额，最多保留两位小数')
  assert.equal((await request('/admin/goods/add', { ...goods, price: '1.23', stock: -1 }, adminToken)).errmsg, '商品库存必须是有效的非负整数')
  assert.equal(
    (await request('/admin/goods/add', {
      ...goods,
      price: '1.23',
      description: '<p>介绍</p><img src="uploads/detail.png">'
    }, adminToken)).errmsg,
    '商品介绍不能包含图片，请使用主图或图片相册上传'
  )
  assert.equal((await request('/admin/category/', undefined, adminToken)).errmsg, '分类ID不正确')
})

test('登录注册拒绝非法输入，不将外部数据当作已校验的 TS 类型', async () => {
  assert.equal((await request('/admin/login', { username: {}, password: [] })).errno, 1)
  assert.equal((await request('/home/login', {})).errno, 1)
  assert.equal((await request('/home/register', { username: '!', password: '123456' })).errno, 1)
})

test('不存在的路由维持统一响应格式', async () => {
  const result = await request('/does-not-exist')
  assert.equal(result.status, 404)
  assert.equal(result.errmsg, '接口不存在')
})

test('移除相册图片后只提交剩余文件的服务器路径', () => {
  assert.deepEqual(getAlbumPaths([
    { serverPath: 'uploads/one.png', url: 'blob:temporary' },
    { response: { errno: 0, data: { savepath: 'uploads/two.png' } } },
    { url: 'http://localhost:8360/uploads/three.png' },
    { url: 'blob:pending-upload' },
    { response: { errno: 1, data: null } }
  ]), ['uploads/one.png', 'uploads/two.png', 'uploads/three.png'])
  assert.deepEqual(getAlbumPaths([]), [])
})

test('请求层返回业务数据和空成功结果，失败时抛出业务错误', () => {
  assert.deepEqual(unwrapResponse({ errno: 0, data: { token: 'test-token' }, errmsg: '' }), { token: 'test-token' })
  assert.equal(unwrapResponse({ errno: 0, data: null, errmsg: '' }), null)
  assert.throws(() => unwrapResponse({ errno: 2, data: null, errmsg: '请先登录' }), /请先登录/)
})

test('商品和相册事务在成功时提交，相册失败时回滚并释放连接', async context => {
  const goods = { name: '测试商品', category_id: 1, price: '1.23', stock: 2, picture: 'uploads/a.png', spec: '', description: '' }
  for (const shouldFail of [false, true]) {
    const events: string[] = []
    const connection = {
      async beginTransaction() { events.push('begin') },
      async execute(sql: string) {
        const album = sql.includes('vueshop_goods_album')
        events.push(album ? 'album' : 'goods')
        if (album && shouldFail) throw new Error('simulated album failure')
        return [{ insertId: 42 }, []]
      },
      async commit() { events.push('commit') },
      async rollback() { events.push('rollback') },
      release() { events.push('release') }
    }
    // 仅替换数据库连接边界，不连接或写入真实 MySQL。
    const mocked = context.mock.method(db, 'getConnection', async () => connection)
    if (shouldFail) {
      await assert.rejects(createWithAlbum(goods, ['uploads/a.png']), /simulated album failure/)
      assert.deepEqual(events, ['begin', 'goods', 'album', 'rollback', 'release'])
    } else {
      assert.equal(await createWithAlbum(goods, ['uploads/a.png']), 42)
      assert.deepEqual(events, ['begin', 'goods', 'album', 'commit', 'release'])
    }
    mocked.mock.restore()
  }
})

test('创建订单成功时扣减库存并清理购物车，库存不足时回滚', async context => {
  for (const stock of [3, 1]) {
    const events: string[] = []
    const connection = {
      async beginTransaction() { events.push('begin') },
      async execute(sql: string) {
        if (sql.includes('SELECT') && sql.includes('vueshop_user_address')) {
          events.push('select-address')
          return [[{
            id: 5,
            user_id: 1,
            receiver_name: '测试用户',
            receiver_phone: '13800138000',
            receiver_address: '测试省测试市测试地址',
            is_default: 1
          }], []]
        }
        if (sql.includes('SELECT') && sql.includes('vueshop_cart')) {
          events.push('select-cart')
          return [[{
            cart_id: 8,
            goods_id: 2,
            goods_name: '测试商品',
            goods_picture: 'uploads/test.png',
            goods_spec: '默认规格',
            available_spec: '',
            unit_price: '12.30',
            quantity: 2,
            stock
          }], []]
        }
        if (sql.includes('INSERT INTO vueshop_order_item')) {
          events.push('insert-items')
          return [{ affectedRows: 1 }, []]
        }
        if (sql.includes('INSERT INTO vueshop_order')) {
          events.push('insert-order')
          return [{ insertId: 21 }, []]
        }
        if (sql.includes('UPDATE vueshop_goods')) {
          events.push('update-stock')
          return [{ affectedRows: 1 }, []]
        }
        if (sql.includes('DELETE FROM vueshop_cart')) {
          events.push('delete-cart')
          return [{ affectedRows: 1 }, []]
        }
        throw new Error('unexpected SQL')
      },
      async commit() { events.push('commit') },
      async rollback() { events.push('rollback') },
      release() { events.push('release') }
    }
    const mocked = context.mock.method(db, 'getConnection', async () => connection)
    const input = {
      cart_item_ids: [8],
      address_id: 5
    }

    if (stock >= 2) {
      const result = await createOrder(1, input)
      assert.equal(result.id, 21)
      assert.deepEqual(events, [
        'begin',
        'select-address',
        'select-cart',
        'insert-order',
        'insert-items',
        'update-stock',
        'delete-cart',
        'commit',
        'release'
      ])
    } else {
      await assert.rejects(createOrder(1, input), /库存不足/)
      assert.deepEqual(events, ['begin', 'select-address', 'select-cart', 'rollback', 'release'])
    }
    mocked.mock.restore()
  }
})

test('直接购买创建订单但不执行购物车清理', async context => {
  const events: string[] = []
  const connection = {
    async beginTransaction() { events.push('begin') },
    async execute(sql: string) {
      if (sql.includes('vueshop_user_address')) {
        events.push('select-address')
        return [[{
          id: 5,
          user_id: 1,
          receiver_name: '测试用户',
          receiver_phone: '13800138000',
          receiver_address: '测试省测试市测试地址',
          is_default: 1
        }], []]
      }
      if (sql.includes('NULL AS cart_id')) {
        events.push('select-goods')
        return [[{
          cart_id: null,
          goods_id: 2,
          goods_name: '测试商品',
          goods_picture: 'uploads/test.png',
          goods_spec: '红色',
          available_spec: '红色,蓝色',
          unit_price: '12.30',
          quantity: 1,
          stock: 3
        }], []]
      }
      if (sql.includes('INSERT INTO vueshop_order_item')) { events.push('insert-items'); return [{ affectedRows: 1 }, []] }
      if (sql.includes('INSERT INTO vueshop_order')) { events.push('insert-order'); return [{ insertId: 22 }, []] }
      if (sql.includes('UPDATE vueshop_goods')) { events.push('update-stock'); return [{ affectedRows: 1 }, []] }
      throw new Error('unexpected SQL')
    },
    async commit() { events.push('commit') },
    async rollback() { events.push('rollback') },
    release() { events.push('release') }
  }
  const mocked = context.mock.method(db, 'getConnection', async () => connection)
  const result = await createOrder(1, {
    direct_item: { goods_id: 2, quantity: 1, selected_spec: '红色' },
    address_id: 5
  })
  assert.equal(result.id, 22)
  assert.deepEqual(events, [
    'begin', 'select-address', 'select-goods', 'insert-order',
    'insert-items', 'update-stock', 'commit', 'release'
  ])
  mocked.mock.restore()
})
