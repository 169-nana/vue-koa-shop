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

router.post('/events/product-click', agentEventRateLimit, shopAgentController.trackProductClick)
router.post(
  '/events/product-click-auth',
  userAuth,
  agentEventRateLimit,
  shopAgentController.trackProductClick
)
router.post('/feedback', agentEventRateLimit, shopAgentController.feedback)
router.post('/feedback-auth', userAuth, agentEventRateLimit, shopAgentController.feedback)

export default router
