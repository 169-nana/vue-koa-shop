const Router = require('@koa/router')

const auth = require('../middleware/auth')
const uploadPicture = require('../middleware/upload')
const uploadController = require('../controller/upload')

const router = new Router({
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

module.exports = router
