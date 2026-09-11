import type { AppMiddleware } from '../types'
import { fail } from '../utils/response'
import * as merchantService from '../service/merchant'

const merchantAuth: AppMiddleware = async (ctx, next) => {
  const user = ctx.state.user
  if (!user) {
    ctx.body = fail('请先登录', 2)
    return
  }
  const rawMerchantId = ctx.query.merchant_id
  const merchantId = typeof rawMerchantId === 'string' ? Number(rawMerchantId) : Number.NaN
  if (!Number.isInteger(merchantId) || merchantId <= 0) {
    ctx.body = fail('请选择要管理的店铺')
    return
  }
  const merchant = await merchantService.findApprovedByUserId(user.id, merchantId)
  if (!merchant) {
    ctx.body = fail('商家资格未通过或已停用')
    return
  }
  ctx.state.merchant = merchant
  await next()
}

export default merchantAuth
