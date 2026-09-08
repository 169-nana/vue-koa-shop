import type { AppState } from '../types'
import Router from '@koa/router'

import auth from '../middleware/auth'
import uploadPicture from '../middleware/upload'
import * as uploadController from '../controller/upload'

const router = new Router<AppState>({
  prefix: '/admin/upload'
})

router.post(
  '/picture',

  // 必须先鉴权，避免未登录用户写入文件
  auth,
  // 解析并保存multipart文件
  uploadPicture,

  // 返回保存路径
  uploadController.picture
)

export default router
