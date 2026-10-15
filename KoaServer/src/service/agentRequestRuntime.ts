interface ActiveAgentRequest {
  userId: number
  controller: AbortController
}

const activeRequests = new Map<string, ActiveAgentRequest>()

export function registerAgentRequest(requestId: string, userId: number): AbortController {
  const controller = new AbortController()
  activeRequests.set(requestId, { userId, controller })
  return controller
}

export function unregisterAgentRequest(requestId: string): void {
  activeRequests.delete(requestId)
}

export function cancelAgentRequest(requestId: string, userId: number): boolean {
  const request = activeRequests.get(requestId)
  if (!request || request.userId !== userId) return false
  request.controller.abort()
  activeRequests.delete(requestId)
  return true
}
