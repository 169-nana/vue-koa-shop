import type { AppState } from '../types'
import Router from '@koa/router'
import * as addressController from '../controller/address'
import userAuth from '../middleware/userAuth'

const router = new Router<AppState>({ prefix: '/home/address' })
router.get('/list', userAuth, addressController.list)
router.post('/add', userAuth, addressController.add)
router.post('/update', userAuth, addressController.update)
router.post('/default', userAuth, addressController.setDefault)
router.post('/remove', userAuth, addressController.remove)
export default router
