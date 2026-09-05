const jwt = require('jsonwebtoken')

const config = require('../config')
const userService = require('../service/user')
const { fail } = require('../utils/response')

module.exports = async (ctx, next) => {
  const token = ctx.headers.jwt

  if (!token) {
    ctx.body = fail('请先登录', 2)
    return
  }

  let payload

  try {
    payload = jwt.verify(
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

  if (payload.type !== 'user') {
    ctx.body = fail(
      '没有用户访问权限',
      2
    )
    return
  }

  /*
   * JWT有效不代表数据库中的账号
   * 仍然存在或仍处于启用状态。
   */
  const user = await userService.findById(
    payload.id
  )

  if (!user) {
    ctx.body = fail(
      '用户不存在或已被删除',
      2
    )
    return
  }

  if (user.status !== 1) {
    ctx.body = fail(
      '账号已被禁用',
      2
    )
    return
  }

  ctx.state.user = user

  await next()
}