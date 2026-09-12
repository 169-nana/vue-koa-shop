import type { RowDataPacket } from 'mysql2/promise'

import db from '../db'
import { SHOP_AGENT_INSTRUCTIONS } from '../agent/instructions'

interface PublishedPromptRow extends RowDataPacket {
  id: number
  content: string
}

export interface ActiveAgentPrompt {
  id: number | null
  content: string
}

let cachedPrompt: ActiveAgentPrompt | null = null
let cacheExpiresAt = 0

export function invalidateAgentPromptCache(): void {
  cachedPrompt = null
  cacheExpiresAt = 0
}

export async function getActiveAgentPrompt(): Promise<ActiveAgentPrompt> {
  if (cachedPrompt && cacheExpiresAt > Date.now()) return cachedPrompt

  try {
    const [rows] = await db.execute<PublishedPromptRow[]>(
      `
        SELECT id, content
        FROM vueshop_agent_prompt_version
        WHERE status = 'published'
        ORDER BY published_at DESC, id DESC
        LIMIT 1
      `
    )
    cachedPrompt = rows[0]
      ? { id: rows[0].id, content: rows[0].content }
      : { id: null, content: SHOP_AGENT_INSTRUCTIONS }
  } catch (error: unknown) {
    console.warn(
      'Agent prompt table unavailable, using bundled prompt:',
      error instanceof Error ? error.message : 'Unknown error'
    )
    cachedPrompt = { id: null, content: SHOP_AGENT_INSTRUCTIONS }
  }

  cacheExpiresAt = Date.now() + 30_000
  return cachedPrompt
}
