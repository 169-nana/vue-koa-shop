import type { AppState } from '../types'
import Router from '@koa/router'
import * as reviewController from '../controller/review'
import userAuth from '../middleware/userAuth'

const router = new Router<AppState>({ prefix: '/home/review' })
router.get('/goods', reviewController.goodsList)
router.get('/reviewable', userAuth, reviewController.reviewable)
router.post('/create', userAuth, reviewController.create)
export default router
