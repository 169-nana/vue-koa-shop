import type { AppState } from '../types'
import Router from '@koa/router'
import * as refundController from '../controller/refund'
import userAuth from '../middleware/userAuth'

const router = new Router<AppState>({ prefix: '/home/refund' })
router.get('/list', userAuth, refundController.list)
router.post('/create', userAuth, refundController.create)
export default router
