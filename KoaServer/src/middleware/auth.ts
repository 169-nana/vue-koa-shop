import type { AppMiddleware } from '../types'
import { isAuthIdentity } from '../utils/identity'
import jwt from 'jsonwebtoken'
import config from '../config/index'
import { fail } from '../utils/response'

// 鉴权中间件
const middleware: AppMiddleware = async (ctx, next) => {
  // 前端在请求头中携带 token
  const token = ctx.headers.jwt

  if (typeof token !== 'string' || !token) {
    ctx.body = fail('请先登录', 2)
    return
  }

  let admin

   // 只处理JWT解析和验证错误
  try {
    admin = jwt.verify(
      token,
      config.jwtSecret
    )
  } catch (error) {
    const message =
      error instanceof Error && error.name === 'TokenExpiredError'
        ? '登录已过期，请重新登录'
        : '登录状态无效，请重新登录'

    ctx.body = fail(message, 2)
    return
  }

  // JWT有效后，再检查身份类型
  if (!isAuthIdentity(admin) || admin.type !== 'admin') {
    ctx.body = fail(
      '没有管理员访问权限',
      2
    )
    return
  }

  ctx.state.admin = admin

  // Controller 错误交给全局错误中间件
  await next()
}

export default middleware
