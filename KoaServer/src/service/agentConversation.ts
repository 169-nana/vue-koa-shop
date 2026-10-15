import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'

import type { Goods, ShopAgentConversation } from '../../../shared/api'

import db from '../db'
import { AppError, getBody } from '../utils/input'

interface ConversationRow extends RowDataPacket {
  id: number
  title: string
  context: string | object | null
  revision: number
  created_at: Date
  updated_at: Date
}

export interface AgentConversationProduct {
  id: number
  name: string
}

export interface AgentConversationContext {
  products: AgentConversationProduct[]
}

export interface AgentConversationState extends AgentConversationContext {
  revision: number
}

function toConversation(row: ConversationRow): ShopAgentConversation {
  return {
    id: Number(row.id),
    title: row.title,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString()
  }
}

function parseContext(value: unknown): AgentConversationContext {
  let parsed: unknown = value
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value) } catch { return { products: [] } }
  }
  const products = getBody(parsed).products
  if (!Array.isArray(products)) return { products: [] }
  return {
    products: products.flatMap(item => {
      const body = getBody(item)
      return typeof body.id === 'number' && Number.isInteger(body.id) && body.id > 0 &&
        typeof body.name === 'string' && body.name.length > 0
        ? [{ id: body.id, name: body.name }]
        : []
    }).slice(0, 8)
  }
}

export function conversationTitle(content: string): string {
  const compact = content.replace(/\s+/g, ' ').trim()
  return compact.length > 24 ? `${compact.slice(0, 24)}…` : compact || '新对话'
}

export async function listAgentConversations(userId: number): Promise<ShopAgentConversation[]> {
  await pruneExpiredAgentHistory(userId)
  const [rows] = await db.execute<ConversationRow[]>(
    `SELECT id, title, context, created_at, updated_at
     FROM vueshop_agent_conversation
     WHERE user_id = ?
     ORDER BY updated_at DESC, id DESC
     LIMIT 50`,
    [userId]
  )
  return rows.map(toConversation)
}

export async function pruneExpiredAgentHistory(userId: number): Promise<void> {
  await db.execute<ResultSetHeader>(
    `DELETE FROM vueshop_agent_chat_message
     WHERE user_id = ? AND created_at < DATE_SUB(NOW(), INTERVAL 90 DAY)`,
    [userId]
  )
  await db.execute<ResultSetHeader>(
    `DELETE conversation FROM vueshop_agent_conversation AS conversation
     LEFT JOIN vueshop_agent_chat_message AS message
       ON message.conversation_id = conversation.id
     WHERE conversation.user_id = ?
       AND conversation.updated_at < DATE_SUB(NOW(), INTERVAL 90 DAY)
       AND message.id IS NULL`,
    [userId]
  )
}

export async function createAgentConversation(
  userId: number,
  requestedTitle?: string
): Promise<ShopAgentConversation> {
  const title = requestedTitle?.trim().slice(0, 60) || '新对话'
  const [result] = await db.execute<ResultSetHeader>(
    'INSERT INTO vueshop_agent_conversation (user_id, title) VALUES (?, ?)',
    [userId, title]
  )
  const [rows] = await db.execute<ConversationRow[]>(
    `SELECT id, title, context, created_at, updated_at
     FROM vueshop_agent_conversation WHERE id = ? AND user_id = ? LIMIT 1`,
    [result.insertId, userId]
  )
  const conversation = rows[0]
  if (!conversation) throw new Error('创建会话后无法读取会话')
  return toConversation(conversation)
}

export async function getAgentConversationContext(
  userId: number,
  conversationId: number
): Promise<AgentConversationState> {
  const [rows] = await db.execute<ConversationRow[]>(
    `SELECT id, title, context, revision, created_at, updated_at
     FROM vueshop_agent_conversation WHERE id = ? AND user_id = ? LIMIT 1`,
    [conversationId, userId]
  )
  if (!rows[0]) throw new AppError('对话不存在或无权访问', 'AGENT_CONVERSATION_NOT_FOUND')
  return { ...parseContext(rows[0].context), revision: Number(rows[0].revision) }
}

export async function deleteAgentConversation(userId: number, conversationId: number): Promise<void> {
  const connection = await db.getConnection()
  try {
    await connection.beginTransaction()
    const [result] = await connection.execute<ResultSetHeader>(
      'DELETE FROM vueshop_agent_conversation WHERE id = ? AND user_id = ?',
      [conversationId, userId]
    )
    if (result.affectedRows !== 1) {
      throw new AppError('对话不存在或无权访问', 'AGENT_CONVERSATION_NOT_FOUND')
    }
    await connection.execute(
      'DELETE FROM vueshop_agent_chat_message WHERE conversation_id = ? AND user_id = ?',
      [conversationId, userId]
    )
    await connection.commit()
  } catch (error: unknown) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export function referencedProducts(products: Goods[]): AgentConversationContext {
  return { products: products.slice(0, 8).map(product => ({ id: product.id, name: product.name })) }
}
