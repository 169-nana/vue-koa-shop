import Router from '@koa/router'
import type { AppState } from '../types'
import userAuth from '../middleware/userAuth'
import * as controller from '../controller/notification'

const router = new Router<AppState>({ prefix: '/home/notifications' })
router.get('/', userAuth, controller.list)
router.get('/unread-count', userAuth, controller.unreadCount)
router.post('/read', userAuth, controller.markRead)
router.post('/read-all', userAuth, controller.markAllRead)
export default router
