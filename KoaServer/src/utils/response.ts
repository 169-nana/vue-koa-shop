import type { ApiResponse } from '../../../shared/api'
export function success(): ApiResponse<null>
export function success<T>(data: T): ApiResponse<T>
export function success<T>(data: T | null = null): ApiResponse<T | null> {
  return { errno: 0, data, errmsg: '' }
}
export const fail = (errmsg = '请求失败', errno: 1 | 2 = 1): ApiResponse<never> => ({ errno, data: null, errmsg })
