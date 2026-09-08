import type { AppMiddleware } from '../types'
import { fail } from '../utils/response'
import * as adminService from '../service/admin'

/** 新登录令牌明确携带角色；无 role 的旧令牌按管理员兼容。 */
export const adminOnly: AppMiddleware = async (ctx, next) => {
  if (ctx.state.admin?.role === 'reviewer') {
    ctx.body = fail('审核人员没有执行该操作的权限')
    return
  }
  // 新令牌携带 role，写操作前再次读取数据库，使停用或降级立即生效。
  if (ctx.state.admin?.role === 'admin') {
    const current = await adminService.findById(ctx.state.admin.id)
    if (!current || current.status !== 1 || current.role !== 'admin') {
      ctx.body = fail('管理员账号不存在、已停用或权限已变化', 2)
      return
    }
  }
  await next()
}
