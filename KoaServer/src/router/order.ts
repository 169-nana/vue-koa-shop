import type { AppState } from '../types'
import Router from '@koa/router'

import * as orderController from '../controller/order'
import userAuth from '../middleware/userAuth'

const router = new Router<AppState>({ prefix: '/home/order' })

router.post('/create', userAuth, orderController.create)
router.get('/list', userAuth, orderController.list)
router.get('/detail', userAuth, orderController.detail)
router.post('/cancel', userAuth, orderController.cancel)
router.post('/confirm-receipt', userAuth, orderController.confirmReceipt)

export default router
