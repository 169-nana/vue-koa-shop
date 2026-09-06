import { projectRoot } from '../utils/paths'
import { AppError } from '../utils/input'
//上传中间件
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import multer from '@koa/multer'

//定义上传目录，使用相对路径和__dirname拼接，确保在不同环境下都能正确解析
const uploadDir = path.join(projectRoot, 'public/uploads')

// 目录不存在时自动创建
fs.mkdirSync(uploadDir, {
  recursive: true
})

const extensionMap: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif'
}

//磁盘存储策略
const storage = multer.diskStorage({
  destination(req, file, callback) {
    callback(null, uploadDir)
  },

  filename(req, file, callback) {
    const extension = extensionMap[file.mimetype]

    // 不使用用户提供的原始文件名
    const filename =
      `${crypto.randomUUID()}${extension}`

    callback(null, filename)
  }
})

const uploader = multer({
  storage,

  // 最大500KB，与Vue页面提示保持一致
  limits: {
    fileSize: 500 * 1024,
    files: 1
  },

  fileFilter(req, file, callback) {
    if (!extensionMap[file.mimetype]) {
      const error = new AppError('不支持的图片类型', 'INVALID_IMAGE_TYPE')

      callback(error, false)
      return
    }

    callback(null, true)
  }
})

export default uploader.single('file')
