import Router from '@koa/router'
import type { AppState } from '../types'
import userAuth from '../middleware/userAuth'
import * as controller from '../controller/payment'

const router = new Router<AppState>({ prefix: '/home/payment' })
router.post('/create', userAuth, controller.create)
router.post('/mock-pay', userAuth, controller.mockPay)
router.post('/mock/callback', controller.callback)
export default router
