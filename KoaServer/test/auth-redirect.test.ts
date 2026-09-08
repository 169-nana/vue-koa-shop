import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getAuthRedirect } from '../../shared/auth'

test('登录跳转保留站内路径、查询和哈希', () => {
  for (const target of ['/orders', '/checkout?goods_id=3&quantity=2', '/goods?stock=low#list']) {
    assert.equal(getAuthRedirect(target, '/profile'), target)
  }
})
test('登录跳转拒绝外部地址、非法编码和登录循环', () => {
  for (const target of [undefined, ['orders'], '', 'https://example.com', '//example.com', '/%2fexample.com', '/\\example.com', '/%5cexample.com', '/login', '/register?redirect=/login', '/%6cogin', '/login/', '/bad%zz', '/bad\npath']) {
    assert.equal(getAuthRedirect(target, '/profile'), '/profile')
  }
})
