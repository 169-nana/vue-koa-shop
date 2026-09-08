import type { AppState } from '../types'
import Router from '@koa/router'

import auth from '../middleware/auth'
import { adminOnly } from '../middleware/adminPermission'
import * as goodsController from '../controller/goods'

const router = new Router<AppState>({
  prefix: '/admin/goods'
})

router.get(
  '/list',
  auth,
  goodsController.list
)

router.get(
  '/',
  auth,
  goodsController.detail
)

router.post(
  '/add',
  auth,
  adminOnly,
  goodsController.add
)

router.post(
  '/save',
  auth,
  adminOnly,
  goodsController.save
)

router.post(
  '/del',
  auth,
  adminOnly,
  goodsController.remove
)

export default router
