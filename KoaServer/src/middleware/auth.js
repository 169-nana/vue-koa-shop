const jwt = require('jsonwebtoken')
const config = require('../config/index.js')
const { fail } = require('../utils/response')

// 鉴权中间件
module.exports = async (ctx, next) => {
  // 前端在请求头中携带 token
  const token = ctx.headers.jwt

  if (!token) {
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
      error.name === 'TokenExpiredError'
        ? '登录已过期，请重新登录'
        : '登录状态无效，请重新登录'

    ctx.body = fail(message, 2)
    return
  }

  // JWT有效后，再检查身份类型
  if (admin.type !== 'admin') {
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
