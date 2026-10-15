import Router from '@koa/router'

import type { AppState } from '../types'
import * as shopAgentController from '../controller/shopAgent'
import agentRateLimit, {
  agentActionRateLimit,
  agentEventRateLimit
} from '../middleware/agentRateLimit'
import userAuth from '../middleware/userAuth'

const router = new Router<AppState>({
  prefix: '/home/agent'
})

router.post(
  '/chat',
  agentRateLimit,
  shopAgentController.chat
)

router.post('/stream', agentRateLimit, shopAgentController.streamChat)

router.post(
  '/chat-auth',
  userAuth,
  agentRateLimit,
  shopAgentController.chat
)

router.post(
  '/stream-auth',
  userAuth,
  agentRateLimit,
  shopAgentController.streamChat
)

router.post(
  '/actions/add-to-cart',
  userAuth,
  agentActionRateLimit,
  shopAgentController.confirmAddToCart
)
router.post('/actions/after-sale', userAuth, agentActionRateLimit, shopAgentController.confirmAfterSale)
router.post('/actions/support-ticket', userAuth, agentActionRateLimit, shopAgentController.confirmSupportTicket)

router.post('/events/product-click', agentEventRateLimit, shopAgentController.trackProductClick)
router.post(
  '/events/product-click-auth',
  userAuth,
  agentEventRateLimit,
  shopAgentController.trackProductClick
)
router.post('/feedback', agentEventRateLimit, shopAgentController.feedback)
router.post('/feedback-auth', userAuth, agentEventRateLimit, shopAgentController.feedback)
router.get('/history', userAuth, shopAgentController.history)
router.post('/history/clear', userAuth, shopAgentController.clearHistory)
router.post('/requests/cancel', userAuth, shopAgentController.cancelRequest)
router.get('/conversations', userAuth, shopAgentController.conversations)
router.post('/conversations', userAuth, shopAgentController.createConversation)
router.post('/conversations/delete', userAuth, shopAgentController.deleteConversation)

export default router
