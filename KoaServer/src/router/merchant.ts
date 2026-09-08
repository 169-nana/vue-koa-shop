import Router from '@koa/router'
import type { AppState } from '../types'
import userAuth from '../middleware/userAuth'
import merchantAuth from '../middleware/merchantAuth'
import uploadPicture from '../middleware/upload'
import * as merchantController from '../controller/merchant'
import * as uploadController from '../controller/upload'

const router = new Router<AppState>({ prefix: '/home/merchant' })

router.get('/application', userAuth, merchantController.getApplication)
router.post('/application/submit', userAuth, merchantController.submitApplication)
router.post('/qualification/upload', userAuth, uploadPicture, uploadController.picture)

router.get('/goods/submissions', userAuth, merchantAuth, merchantController.listSubmissions)
router.get('/goods/submission', userAuth, merchantAuth, merchantController.getSubmission)
router.post('/goods/submission/save', userAuth, merchantAuth, merchantController.saveSubmission)
router.post('/goods/submission/submit', userAuth, merchantAuth, merchantController.submitGoods)
router.get('/goods/list', userAuth, merchantAuth, merchantController.listGoods)
router.post('/goods/stock', userAuth, merchantAuth, merchantController.updateStock)
router.post('/goods/sale-status', userAuth, merchantAuth, merchantController.updateSaleStatus)
router.post('/upload/picture', userAuth, merchantAuth, uploadPicture, uploadController.picture)

export default router
