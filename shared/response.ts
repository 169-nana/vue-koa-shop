import type { ApiResponse } from './api'

/** 成功和失败使用不同的类型分支，避免通过断言把 null 当成业务对象。 */
export function unwrapResponse<T>(response: ApiResponse<T>): T {
  if (response.errno !== 0) throw new Error(response.errmsg || '请求失败')
  return response.data
}
