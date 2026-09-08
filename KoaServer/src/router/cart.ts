import type { AppState } from '../types'
import Router from '@koa/router'

import * as cartController
  from '../controller/cart'
import userAuth
  from '../middleware/userAuth'

const router = new Router<AppState>({
  prefix: '/home/cart'
})

router.get(
  '/',
  userAuth,
  cartController.list
)

router.post(
  '/add',
  userAuth,
  cartController.add
)

router.post(
  '/update',
  userAuth,
  cartController.update
)

router.post(
  '/remove',
  userAuth,
  cartController.remove
)

export default router
