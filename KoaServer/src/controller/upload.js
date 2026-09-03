const fs = require('node:fs/promises')
const {
  success,
  fail
} = require('../utils/response')

const allowedTypes = new Set([
  'admin_avatar',
  'category_picture',
  'goods_picture',
  'goods_album',
  'goods_description'
])

exports.picture = async ctx => {
  const file = ctx.file || ctx.request.file
  const type = ctx.request.body?.type

  if (!file) {
    ctx.body = fail('请选择要上传的图片')
    return
  }

  // 校验业务用途
  if (!allowedTypes.has(type)) {
    // 文件已经写入磁盘，业务类型错误时需要清理
    await fs.unlink(file.path).catch(() => {})

    ctx.body = fail('图片用途不正确')
    return
  }

  // 数据库存相对路径，不存绝对磁盘路径
  const savepath = `uploads/${file.filename}`

  ctx.body = success({
    savepath
  })
}