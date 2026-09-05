const Router = require('@koa/router')

const userAuth =
  require('../middleware/userAuth')

const homeUserController =
  require('../controller/homeUser')

const router = new Router({
  prefix: '/home'
})

// 注册不需要登录
router.post(
  '/register',
  homeUserController.register
)

// 登录不需要提前登录
router.post(
  '/login',
  homeUserController.login
)

// 获取用户信息必须登录
router.get(
  '/user',
  userAuth,
  homeUserController.getUser
)

module.exports = router