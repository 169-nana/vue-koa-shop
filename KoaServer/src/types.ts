//存放后端内部类型

import type { DefaultContext, Middleware, ParameterizedContext } from 'koa'
import type { AdminRole, ApiResponse, MerchantStatus, PublicUser } from '../../shared/api'
export interface AuthIdentity { id: number; type: 'admin' | 'user'; role?: AdminRole }
export interface UserState extends PublicUser { status: number }
export interface MerchantState { id: number; user_id: number; shop_name: string; status: MerchantStatus }
export interface AppState { admin?: AuthIdentity; user?: UserState; merchant?: MerchantState }
export type AppContext = ParameterizedContext<AppState>
export type AppMiddleware<T = unknown> = Middleware<AppState, DefaultContext, ApiResponse<T>>
export interface GoodsFilters {
  keyword?: string; categoryId?: number | null; minPrice?: number | null;
  maxPrice?: number | null; minStock?: number | null; maxStock?: number | null
}
/**
 * Service 层使用的前台商品筛选条件。
 *
 * 这里使用 camelCase，因为它不是 HTTP 接口原始参数，
 * 而是 Controller 校验完成后交给 Service 的内部数据。
 */
export interface PublicGoodsFilters {
  lastId: number
  pagesize: number
  categoryId: number
}
