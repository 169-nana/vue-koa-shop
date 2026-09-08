import type { AppMiddleware } from '../types'
import * as adminService from '../service/admin'
import { fail } from '../utils/response'

/** 审核属于敏感操作，每次都读取数据库，确保停用和角色变更立即生效。 */
const activeAdmin: AppMiddleware = async (ctx, next) => {
  const identity = ctx.state.admin
  if (!identity) { ctx.body = fail('请先登录', 2); return }
  const admin = await adminService.findById(identity.id)
  if (!admin || admin.status !== 1 || (admin.role !== 'admin' && admin.role !== 'reviewer')) {
    ctx.body = fail('后台账号不存在、已停用或角色无效', 2)
    return
  }
  ctx.state.admin = { ...identity, role: admin.role }
  await next()
}
export default activeAdmin
