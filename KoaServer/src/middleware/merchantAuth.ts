import type { AppMiddleware } from '../types'
import { fail } from '../utils/response'
import * as merchantService from '../service/merchant'

const merchantAuth: AppMiddleware = async (ctx, next) => {
  const user = ctx.state.user
  if (!user) {
    ctx.body = fail('请先登录', 2)
    return
  }
  const merchant = await merchantService.findApprovedByUserId(user.id)
  if (!merchant) {
    ctx.body = fail('商家资格未通过或已停用')
    return
  }
  ctx.state.merchant = merchant
  await next()
}

export default merchantAuth
