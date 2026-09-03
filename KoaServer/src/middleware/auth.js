const jwt = require('jsonwebtoken')
const config = require('../config/index.js')
const { fail } = require('../utils/response')

//鉴权中间件
module.exports = async (ctx, next) => {
  //前端在请求头中携带token
  const token = ctx.headers.jwt
//如果token不存在或错误，返回错误信息
  if (!token) {
    ctx.body = fail('请先登录', 2)
    return
  }

let admin

  // try只包围可能产生JWT错误的代码
  try {
    //验证客户端发来的token，并取得其中真实的数据
     admin = jwt.verify(token, config.jwtSecret)
  } catch (error) {
  const message = error.name === 'TokenExpiredError'
      ? '登录已过期，请重新登录'
      : '登录状态无效，请重新登录'

    ctx.body = fail(message, 2)
    return
  }
  
  ctx.state.admin = admin

  //Controller错误交给全局错误中间件
  await next()
}

