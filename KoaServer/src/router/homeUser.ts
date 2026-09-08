import type { AppState } from '../types'
import Router from '@koa/router'

import userAuth from '../middleware/userAuth'

import * as homeUserController from '../controller/homeUser'
import * as uploadController from '../controller/upload'
import uploadPicture from '../middleware/upload'

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

router.get('/user/dashboard', userAuth, homeUserController.getDashboard)
router.post('/user/avatar/upload', userAuth, uploadPicture, uploadController.picture)
router.post('/user/avatar', userAuth, homeUserController.changeAvatar)

export default router
