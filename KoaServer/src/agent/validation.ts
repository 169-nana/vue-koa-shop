import type {
  ShopAgentMessage
} from '../../../shared/api'

import { getBody } from '../utils/input'

// 运行时输入校验，防止客户端伪造json
// 拒绝：
// - 空对话。
// - 超过 12 条的历史记录。
// - 单条超过 2000 字。
// - 总长度超过 8000 字。
// - 前端伪造的 system 或 tool 消息。
// - 最后一条不是用户消息的请求。

const MAX_MESSAGES = 12
const MAX_MESSAGE_LENGTH = 2000
const MAX_TOTAL_LENGTH = 8000

export function parseAgentMessages(
  value: unknown
): ShopAgentMessage[] | null {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > MAX_MESSAGES
  ) {
    return null
  }

  const messages: ShopAgentMessage[] = []
  let totalLength = 0

  for (const item of value) {
    const body = getBody(item)

    if (
      (
        body.role !== 'user' &&
        body.role !== 'assistant'
      ) ||
      typeof body.content !== 'string'
    ) {
      return null
    }

    const content = body.content.trim()

    if (
      content.length === 0 ||
      content.length > MAX_MESSAGE_LENGTH
    ) {
      return null
    }

    totalLength += content.length

    if (totalLength > MAX_TOTAL_LENGTH) {
      return null
    }

    messages.push({
      role: body.role,
      content
    })
  }

  const lastMessage =
    messages[messages.length - 1]

  if (lastMessage?.role !== 'user') {
    return null
  }

  return messages
}