import type { UploadResult } from '../../../shared/api'
import type { AppMiddleware } from '../types'
import { getBody } from '../utils/input'
import fs from 'node:fs/promises'
import { success, fail } from '../utils/response'

const allowedTypes = new Set([
  'admin_avatar',
  'user_avatar',
  'category_picture',
  'goods_picture',
  'goods_album',
  'goods_description'
])

export const picture: AppMiddleware<UploadResult> = async ctx => {
  const file = ctx.file || ctx.request.file
  const type = getBody(ctx.request.body).type

  if (!file) {
    ctx.body = fail('请选择要上传的图片')
    return
  }

  // 校验业务用途
  if (typeof type !== 'string' || !allowedTypes.has(type)) {
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
