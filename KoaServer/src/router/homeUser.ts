import type { AppState } from '../types'
import Router from '@koa/router'

import userAuth from '../middleware/userAuth'

import * as homeUserController from '../controller/homeUser'

const router = new Router<AppState>({
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

export default router