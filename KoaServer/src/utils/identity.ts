import type { AppContext, AuthIdentity, UserState } from '../types'
export function isAuthIdentity(value: unknown): value is AuthIdentity {
  if (typeof value !== 'object' || value === null) return false
  return 'id' in value && typeof value.id === 'number' && Number.isInteger(value.id) && value.id > 0 &&
    'type' in value && (value.type === 'admin' || value.type === 'user') &&
    (!('role' in value) || value.role === 'admin' || value.role === 'reviewer')
}
export function requireAdmin(ctx: AppContext): AuthIdentity {
  if (!ctx.state.admin) ctx.throw(401, '请先登录')
  return ctx.state.admin
}
export function requireUser(ctx: AppContext): UserState {
  if (!ctx.state.user) ctx.throw(401, '请先登录')
  return ctx.state.user
}
