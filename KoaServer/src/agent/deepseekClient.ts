import OpenAI from 'openai'

import config from '../config'
import { AppError } from '../utils/input'

let client: OpenAI | null = null

//AI 客户端连接器
export function getDeepSeekClient(): OpenAI {
  const apiKey = config.deepseek.apiKey

  if (!apiKey) {
    throw new AppError(
      '智能助手尚未配置',
      'AGENT_NOT_CONFIGURED'
    )
  }

  client ??= new OpenAI({
    apiKey,
    baseURL: config.deepseek.baseURL
  })

  return client
}