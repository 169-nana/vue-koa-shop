import Router from '@koa/router'
import type { AppState } from '../types'
import auth from '../middleware/auth'
import activeAdmin from '../middleware/activeAdmin'
import * as controller from '../controller/moderation'

const router = new Router<AppState>({ prefix: '/admin/review' })
router.get('/reasons', auth, activeAdmin, controller.reasons)
router.get('/merchants', auth, activeAdmin, controller.merchantList)
router.post('/merchants/decision', auth, activeAdmin, controller.reviewMerchant)
router.get('/goods', auth, activeAdmin, controller.goodsList)
router.post('/goods/decision', auth, activeAdmin, controller.reviewGoods)
export default router
