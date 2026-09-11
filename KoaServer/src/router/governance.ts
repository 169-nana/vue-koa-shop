import Router from '@koa/router'
import type { AppState } from '../types'
import auth from '../middleware/auth'
import activeAdmin from '../middleware/activeAdmin'
import * as controller from '../controller/governance'

const router = new Router<AppState>({ prefix: '/admin/governance' })
router.get('/goods', auth, activeAdmin, controller.goods)
router.get('/merchants', auth, activeAdmin, controller.merchants)
router.get('/review-records', auth, activeAdmin, controller.reviewRecords)
router.get('/enforcement-records', auth, activeAdmin, controller.enforcementRecords)
router.get('/reasons', auth, activeAdmin, controller.reasons)
router.post('/enforce', auth, activeAdmin, controller.enforce)
router.get('/preview', auth, activeAdmin, controller.preview)
router.get('/detail', auth, activeAdmin, controller.detail)
export default router
