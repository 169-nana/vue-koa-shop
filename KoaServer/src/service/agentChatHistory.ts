import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'

import type {
  ShopAgentActionStatus,
  ShopAgentHistoryAction,
  ShopAgentHistoryMessage,
  ShopAgentHistoryPage,
  ShopAgentMessageRole
} from '../../../shared/api'

import db from '../db'
import { AppError } from '../utils/input'
import { conversationTitle, type AgentConversationContext } from './agentConversation'
import { signAgentActionToken } from './agentActionToken'

interface AgentChatMessageRow extends RowDataPacket {
  id: number
  user_id: number
  request_id: string
  role: string
  content: string
  created_at: Date
  action_id: string | null
  action_type: string | null
  action_status: string | null
  action_title: string | null
  action_description: string | null
  action_expires_at: Date | null
}

interface ConversationIdRow extends RowDataPacket { id: number; revision: number }

function messageRole(value: string): ShopAgentMessageRole {
  return value === 'user' ? 'user' : 'assistant'
}

function toHistoryMessage(row: AgentChatMessageRow): ShopAgentHistoryMessage {
  const action = toHistoryAction(row)
  return {
    id: Number(row.id),
    request_id: row.request_id,
    role: messageRole(row.role),
    content: row.content,
    created_at: row.created_at.toISOString(),
    ...(action ? { action } : {})
  }
}

function actionType(value: string | null): ShopAgentHistoryAction['type'] | null {
  return value === 'add_to_cart' || value === 'apply_after_sale' || value === 'create_support_ticket'
    ? value
    : null
}

function actionStatus(value: string | null, expiresAt: Date): ShopAgentActionStatus {
  if (value === 'prepared' && expiresAt.getTime() <= Date.now()) return 'expired'
  return value === 'prepared' || value === 'executing' || value === 'succeeded' || value === 'failed'
    ? value
    : 'failed'
}

function toHistoryAction(row: AgentChatMessageRow): ShopAgentHistoryAction | null {
  const type = actionType(row.action_type)
  if (row.role !== 'assistant' || !row.action_id || !type || !row.action_expires_at) return null
  const status = actionStatus(row.action_status, row.action_expires_at)
  return {
    type,
    status,
    title: row.action_title ?? '',
    description: row.action_description ?? '',
    expires_at: row.action_expires_at.toISOString(),
    ...(status === 'prepared'
      ? { token: signAgentActionToken(type, row.user_id, row.action_id, row.action_expires_at) }
      : {})
  }
}

export async function saveAgentExchange(
  userId: number,
  conversationId: number,
  requestId: string,
  userContent: string,
  assistantContent: string,
  context: AgentConversationContext,
  expectedRevision: number
): Promise<void> {
  const connection = await db.getConnection()
  try {
    await connection.beginTransaction()
    const [conversations] = await connection.execute<ConversationIdRow[]>(
      `SELECT id, revision FROM vueshop_agent_conversation
       WHERE id = ? AND user_id = ? LIMIT 1 FOR UPDATE`,
      [conversationId, userId]
    )
    const conversation = conversations[0]
    if (!conversation) throw new AppError('保存聊天记录时会话已不存在', 'AGENT_CONVERSATION_STALE')
    if (Number(conversation.revision) !== expectedRevision) {
      throw new AppError('对话已被清空，忽略较早的回复', 'AGENT_CONVERSATION_STALE')
    }
    await connection.execute<ResultSetHeader>(
      `INSERT INTO vueshop_agent_chat_message
         (user_id, conversation_id, request_id, role, content)
       VALUES (?, ?, ?, 'user', ?), (?, ?, ?, 'assistant', ?)`,
      [
        userId, conversationId, requestId, userContent,
        userId, conversationId, requestId, assistantContent
      ]
    )
    const contextJson = context.products.length > 0 ? JSON.stringify(context) : null
    await connection.execute<ResultSetHeader>(
      `UPDATE vueshop_agent_conversation
       SET title = IF(title = '新对话', ?, title),
           context = COALESCE(?, context),
           updated_at = NOW()
       WHERE id = ? AND user_id = ?`,
      [conversationTitle(userContent), contextJson, conversationId, userId]
    )
    await connection.commit()
  } catch (error: unknown) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function getAgentChatHistory(
  userId: number,
  conversationId: number,
  beforeId: number | null,
  pageSize: number
): Promise<ShopAgentHistoryPage> {
  const values: number[] = [userId, conversationId]
  const beforeClause = beforeId === null ? '' : 'AND message.id < ?'
  if (beforeId !== null) values.push(beforeId)
  values.push(pageSize + 1)

  const [rows] = await db.execute<AgentChatMessageRow[]>(
    `SELECT message.id, message.user_id, message.request_id, message.role,
            message.content, message.created_at,
            action.id AS action_id, action.action_type, action.status AS action_status,
            action.title AS action_title, action.description AS action_description,
            action.expires_at AS action_expires_at
     FROM vueshop_agent_chat_message AS message
     LEFT JOIN vueshop_agent_action AS action
       ON action.user_id = message.user_id
      AND action.conversation_id = message.conversation_id
      AND action.request_id = message.request_id
     WHERE message.user_id = ? AND message.conversation_id = ? ${beforeClause}
     ORDER BY message.id DESC
     LIMIT ?`,
    values
  )
  const hasMore = rows.length > pageSize
  const pageRows = rows.slice(0, pageSize).reverse()
  const list = pageRows.map(toHistoryMessage)

  return {
    list,
    hasMore,
    nextBeforeId: hasMore && list.length > 0 ? list[0].id : null
  }
}

export async function clearAgentChatHistory(userId: number, conversationId: number): Promise<void> {
  const connection = await db.getConnection()
  try {
    await connection.beginTransaction()
    const [result] = await connection.execute<ResultSetHeader>(
      `UPDATE vueshop_agent_conversation
       SET title = '新对话', context = NULL, revision = revision + 1, updated_at = NOW()
       WHERE id = ? AND user_id = ?`,
      [conversationId, userId]
    )
    if (result.affectedRows !== 1) {
      throw new AppError('对话不存在或无权访问', 'AGENT_CONVERSATION_NOT_FOUND')
    }
    await connection.execute<ResultSetHeader>(
      'DELETE FROM vueshop_agent_chat_message WHERE user_id = ? AND conversation_id = ?',
      [userId, conversationId]
    )
    await connection.commit()
  } catch (error: unknown) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}
