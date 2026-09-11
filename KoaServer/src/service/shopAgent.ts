import type {
  ChatCompletionAssistantMessageParam,
  ChatCompletionCreateParamsStreaming,
  ChatCompletionMessageFunctionToolCall,
  ChatCompletionMessageParam
} from 'openai/resources/chat/completions'

import type {
  ShopAgentMessage,
  ShopAgentReply
} from '../../../shared/api'

import config from '../config'
import { getDeepSeekClient } from '../agent/deepseekClient'
import { SHOP_AGENT_INSTRUCTIONS } from '../agent/instructions'
import { SHOP_AGENT_TOOLS } from '../agent/tools'
import { executeShopAgentTool } from '../agent/executeTool'
import { AppError } from '../utils/input'

const MAX_TOOL_ROUNDS = 4

export interface ShopAgentRunResult extends ShopAgentReply {
  toolCalls: number
}

type DeepSeekChatRequest =
  ChatCompletionCreateParamsStreaming & {
    thinking: {
      type: 'disabled'
    }
  }

export async function runShopAgent(
  history: ShopAgentMessage[],
  userId?: number,
  onDelta?: (content: string) => void,
  onReset?: () => void
): Promise<ShopAgentRunResult> {
  const messages: ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: SHOP_AGENT_INSTRUCTIONS
    },
    ...history.map(message => ({
      role: message.role,
      content: message.content
    }))
  ]

  try {
    const client = getDeepSeekClient()
    const referencedProducts = new Map<number, ShopAgentReply['products'][number]>()
    let pendingAction: ShopAgentReply['pending_action']
    let toolCalls = 0

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const request: DeepSeekChatRequest = {
        model: config.deepseek.model,
        messages,
        stream: true,
        tools: SHOP_AGENT_TOOLS,
        tool_choice: 'auto',
        thinking: { type: 'disabled' },
        temperature: 0.2,
        max_tokens: 800
      }
      const response = await client.chat.completions.create(request)
      const callParts = new Map<number, {
        id: string
        name: string
        arguments: string
      }>()
      let content = ''
      let responseMode: 'unknown' | 'text' | 'tool' = 'unknown'

      for await (const chunk of response) {
        const delta = chunk.choices[0]?.delta
        if (!delta) continue

        for (const call of delta.tool_calls ?? []) {
          if (responseMode === 'text') {
            content = ''
            onReset?.()
          }
          responseMode = 'tool'
          const current = callParts.get(call.index) ?? {
            id: '',
            name: '',
            arguments: ''
          }
          if (call.id) current.id = call.id
          if (call.function?.name) current.name += call.function.name
          if (call.function?.arguments) current.arguments += call.function.arguments
          callParts.set(call.index, current)
        }

        if (delta.content) {
          if (responseMode === 'tool') continue
          responseMode = 'text'
          content += delta.content
          onDelta?.(delta.content)
        }
      }

      const functionCalls: ChatCompletionMessageFunctionToolCall[] = [
        ...callParts.values()
      ].map(call => {
        if (!call.id || !call.name) throw new Error('DeepSeek 返回了无效工具调用')
        return {
          id: call.id,
          type: 'function',
          function: {
            name: call.name,
            arguments: call.arguments
          }
        }
      })
      const assistantMessage: ChatCompletionAssistantMessageParam = {
        role: 'assistant',
        content: content || null,
        ...(functionCalls.length > 0 ? { tool_calls: functionCalls } : {})
      }
      messages.push(assistantMessage)

      if (functionCalls.length === 0) {
        content = content.trim()
        if (!content) throw new Error('DeepSeek 没有返回有效文本')
        return {
          message: content,
          products: [...referencedProducts.values()],
          ...(pendingAction ? { pending_action: pendingAction } : {}),
          toolCalls
        }
      }

      for (const call of functionCalls) {
        toolCalls += 1
        if (call.function.name === 'prepare_add_to_cart' && pendingAction) {
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify({ error: '一次只能准备一件商品的加购确认' })
          })
          continue
        }
        const result = await executeShopAgentTool(call, userId)
        result.products.forEach(product => referencedProducts.set(product.id, product))
        if (result.pendingAction) pendingAction = result.pendingAction
        messages.push({ role: 'tool', tool_call_id: call.id, content: result.content })
      }
    }

    throw new Error('智能助手工具调用次数超过限制')
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error
    }

    console.error(
      'Shop agent failed:',
      error instanceof Error ? error.message : 'Unknown error'
    )

    throw new AppError(
      '智能助手暂时不可用，请稍后重试',
      'AGENT_PROVIDER_ERROR'
    )
  }
}
