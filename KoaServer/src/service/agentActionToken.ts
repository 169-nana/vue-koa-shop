import jwt from 'jsonwebtoken'

import type { ShopAgentPendingAction } from '../../../shared/api'

import config from '../config'

const ISSUER = 'vueshop-agent'
const AUDIENCE = 'vueshop-agent-action'

const tokenType: Record<ShopAgentPendingAction['type'], string> = {
  add_to_cart: 'agent_cart_action',
  apply_after_sale: 'agent_after_sale_action',
  create_support_ticket: 'agent_support_action'
}

export interface AgentActionContext {
  conversationId?: number
  requestId?: string
}

export function signAgentActionToken(
  actionType: ShopAgentPendingAction['type'],
  userId: number,
  actionId: string,
  expiresAt: Date
): string {
  const expiresIn = Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 1000))
  return jwt.sign(
    { type: tokenType[actionType], userId, actionId },
    config.jwtSecret,
    { expiresIn, issuer: ISSUER, audience: AUDIENCE }
  )
}
