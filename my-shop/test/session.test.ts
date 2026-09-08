import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import useTokenStore from '../src/stores/token'

test('同步其他标签页的登录、账号切换、退出和清空存储', () => {
  const values = new Map<string, string>()
  let writes = 0
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { writes++; values.set(key, value) },
    removeItem: (key: string) => { writes++; values.delete(key) }
  } })
  try {
    setActivePinia(createPinia())
    const store = useTokenStore()
    assert.equal(store.token, '')
    store.updateToken('session-a')
    assert.equal(values.get('shop_user_token'), 'session-a')
    values.set('shop_user_token', 'session-b')
    store.syncFromStorage()
    assert.equal(store.token, 'session-b')
    assert.equal(writes, 1, '同步其他标签页时不再次写入存储，避免同步循环')
    values.delete('shop_user_token')
    store.syncFromStorage()
    assert.equal(store.token, '')
    values.set('shop_user_token', 'session-c')
    store.syncFromStorage()
    assert.equal(store.token, 'session-c')
    values.clear()
    store.syncFromStorage()
    assert.equal(store.token, '')
    store.updateToken('session-d')
    store.removeToken()
    assert.equal(store.token, '')
    assert.equal(values.has('shop_user_token'), false)
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
})
