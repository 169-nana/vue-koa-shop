//全局错误类型中间件
const { fail } = require('../utils/response')

module.exports = async (ctx, next) => {
  try {
    await next()

    // 没有任何路由匹配
    if (ctx.status === 404 && !ctx.body) {
      ctx.body = fail('接口不存在')
      ctx.status = 404
    }
  } catch (error) {
    if (error.code === 'LIMIT_FILE_SIZE') {
    ctx.body = fail('图片大小不能超过500KB')
    return
  }

  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    ctx.body = fail('上传文件字段不正确')
    return
  }

  if (error.code === 'INVALID_IMAGE_TYPE') {
    ctx.body = fail('只支持 JPG、PNG、WebP 和 GIF 图片')
    return
  }

    // 详细错误只记录在服务端
    console.error(
      `[${ctx.method}] ${ctx.path}`,
      error
    )

    // 客户端只收到通用提示
    ctx.body = fail('服务器内部错误')
    ctx.status = 500
  }
}