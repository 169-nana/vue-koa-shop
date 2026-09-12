import type {
  ResultSetHeader,
  RowDataPacket
} from 'mysql2/promise'

import type {
  AgentEvalCase,
  AgentEvalCaseInput,
  AgentEvalCaseResult,
  AgentEvalRunResult,
  AgentFeedbackInput,
  AgentKnowledgeInput,
  AgentKnowledgeRecord,
  AgentMetricBreakdown,
  AgentMetricPoint,
  AgentMetrics,
  AgentPromptVersion
} from '../../../shared/api'

import db from '../db'
import { AppError } from '../utils/input'
import { runShopAgent } from './shopAgent'
import { hashAgentRequestKey } from './agentObservability'
import { invalidateAgentPromptCache } from './agentPrompt'

type AgentCallOwnerRow = RowDataPacket & {
  request_key_hash: string
  user_id: number | null
}
type MetricsRow = RowDataPacket & {
  calls: number | string
  successes: number | string
  average_duration_ms: number | string | null
  recommended_products: number | string | null
}
type DailyRow = RowDataPacket & {
  date: string
  calls: number | string
  successes: number | string
  average_duration_ms: number | string
}
type BreakdownRow = RowDataPacket & { name: string; count: number | string }
type ToolRow = RowDataPacket & { tool_names: string | string[] | null }
type KnowledgeRow = RowDataPacket & Omit<AgentKnowledgeRecord, 'enabled'> & { enabled: 0 | 1 }
type PromptRow = RowDataPacket & Omit<AgentPromptVersion, 'eval_score'> & {
  eval_score: string | number | null
}
type EvalCaseRow = RowDataPacket & Omit<AgentEvalCase, 'expected_keywords' | 'forbidden_keywords' | 'require_tool' | 'enabled'> & {
  expected_keywords: string | string[]
  forbidden_keywords: string | string[]
  require_tool: 0 | 1
  enabled: 0 | 1
}

function number(value: number | string | null | undefined): number {
  return Number(value ?? 0)
}

function stringArray(value: string | string[]): string[] {
  if (Array.isArray(value)) return value.filter(item => typeof item === 'string')
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : []
  } catch {
    return []
  }
}

export async function getMetrics(days: number): Promise<AgentMetrics> {
  const [summaryRows] = await db.execute<MetricsRow[]>(
    `
      SELECT COUNT(*) AS calls,
        COALESCE(SUM(success), 0) AS successes,
        COALESCE(AVG(duration_ms), 0) AS average_duration_ms,
        COALESCE(SUM(recommended_products), 0) AS recommended_products
      FROM vueshop_agent_call_log
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    `,
    [days - 1]
  )
  const summary = summaryRows[0]
  const calls = number(summary?.calls)
  const successes = number(summary?.successes)

  const [dailyRows] = await db.execute<DailyRow[]>(
    `
      SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS date,
        COUNT(*) AS calls, SUM(success) AS successes,
        ROUND(AVG(duration_ms)) AS average_duration_ms
      FROM vueshop_agent_call_log
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
      ORDER BY DATE_FORMAT(created_at, '%Y-%m-%d')
    `,
    [days - 1]
  )
  const daily: AgentMetricPoint[] = dailyRows.map(row => ({
    date: row.date,
    calls: number(row.calls),
    successes: number(row.successes),
    average_duration_ms: number(row.average_duration_ms)
  }))

  const [errorRows] = await db.execute<BreakdownRow[]>(
    `
      SELECT IF(error_code = '', 'UNKNOWN_ERROR', error_code) AS name,
        COUNT(*) AS count
      FROM vueshop_agent_call_log
      WHERE success = 0 AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY error_code ORDER BY count DESC LIMIT 10
    `,
    [days - 1]
  )

  const [toolRows] = await db.execute<ToolRow[]>(
    `SELECT tool_names FROM vueshop_agent_call_log
     WHERE tool_calls > 0 AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)`,
    [days - 1]
  )
  const toolCounts = new Map<string, number>()
  toolRows.flatMap(row => row.tool_names ? stringArray(row.tool_names) : [])
    .forEach(name => toolCounts.set(name, (toolCounts.get(name) ?? 0) + 1))

  const [conversionRows] = await db.execute<BreakdownRow[]>(
    `
      SELECT event_type AS name, COUNT(*) AS count
      FROM vueshop_agent_conversion_event
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY event_type
    `,
    [days - 1]
  )
  const conversions = new Map(conversionRows.map(row => [row.name, number(row.count)]))
  const [feedbackRows] = await db.execute<BreakdownRow[]>(
    `
      SELECT rating AS name, COUNT(*) AS count
      FROM vueshop_agent_feedback
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY rating
    `,
    [days - 1]
  )
  const feedback = new Map(feedbackRows.map(row => [row.name, number(row.count)]))

  return {
    days,
    calls,
    successes,
    failures: calls - successes,
    success_rate: calls === 0 ? 0 : Math.round(successes / calls * 10000) / 100,
    average_duration_ms: Math.round(number(summary?.average_duration_ms)),
    recommended_products: number(summary?.recommended_products),
    product_clicks: conversions.get('product_click') ?? 0,
    prepared_actions: conversions.get('action_prepared') ?? 0,
    added_to_cart: conversions.get('add_to_cart') ?? 0,
    helpful: feedback.get('helpful') ?? 0,
    unhelpful: feedback.get('unhelpful') ?? 0,
    daily,
    errors: errorRows.map(row => ({ name: row.name, count: number(row.count) })),
    tools: [...toolCounts.entries()]
      .map(([name, count]): AgentMetricBreakdown => ({ name, count }))
      .sort((left, right) => right.count - left.count)
  }
}

export async function listKnowledge(): Promise<AgentKnowledgeRecord[]> {
  const [rows] = await db.execute<KnowledgeRow[]>(
    `
      SELECT id, category, title, keywords, content, enabled, sort_order,
        valid_from, valid_until, created_at, updated_at
      FROM vueshop_agent_knowledge
      ORDER BY enabled DESC, sort_order ASC, id ASC
    `
  )
  return rows.map(row => ({ ...row, enabled: row.enabled === 1 }))
}

export async function saveKnowledge(adminId: number, input: AgentKnowledgeInput): Promise<number> {
  if (input.id) {
    const [result] = await db.execute<ResultSetHeader>(
      `
        UPDATE vueshop_agent_knowledge
        SET category = ?, title = ?, keywords = ?, content = ?, enabled = ?,
          sort_order = ?, valid_from = ?, valid_until = ?, updated_by = ?
        WHERE id = ?
      `,
      [input.category, input.title, input.keywords, input.content, input.enabled ? 1 : 0,
        input.sort_order, input.valid_from ?? null, input.valid_until ?? null, adminId, input.id]
    )
    if (result.affectedRows === 0) throw new AppError('知识条目不存在', 'KNOWLEDGE_NOT_FOUND')
    return input.id
  }

  const [result] = await db.execute<ResultSetHeader>(
    `
      INSERT INTO vueshop_agent_knowledge (
        category, title, keywords, content, enabled, sort_order,
        valid_from, valid_until, created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [input.category, input.title, input.keywords, input.content, input.enabled ? 1 : 0,
      input.sort_order, input.valid_from ?? null, input.valid_until ?? null, adminId, adminId]
  )
  return result.insertId
}

export async function disableKnowledge(id: number, adminId: number): Promise<void> {
  const [result] = await db.execute<ResultSetHeader>(
    'UPDATE vueshop_agent_knowledge SET enabled = 0, updated_by = ? WHERE id = ?',
    [adminId, id]
  )
  if (result.affectedRows === 0) throw new AppError('知识条目不存在', 'KNOWLEDGE_NOT_FOUND')
}

export async function listPromptVersions(): Promise<AgentPromptVersion[]> {
  const [rows] = await db.execute<PromptRow[]>(
    `
      SELECT p.id, p.version, p.content, p.status, p.eval_score,
        COALESCE(creator.username, CONCAT('管理员#', p.created_by)) AS created_by_name,
        publisher.username AS published_by_name,
        p.created_at, p.published_at
      FROM vueshop_agent_prompt_version AS p
      LEFT JOIN vueshop_admin AS creator ON creator.id = p.created_by
      LEFT JOIN vueshop_admin AS publisher ON publisher.id = p.published_by
      ORDER BY p.version DESC
    `
  )
  return rows.map(row => ({ ...row, eval_score: row.eval_score === null ? null : number(row.eval_score) }))
}

export async function createPromptVersion(adminId: number, content: string): Promise<number> {
  const connection = await db.getConnection()
  try {
    await connection.beginTransaction()
    const [versions] = await connection.execute<(RowDataPacket & { version: number | string })[]>(
      'SELECT COALESCE(MAX(version), 0) AS version FROM vueshop_agent_prompt_version FOR UPDATE'
    )
    const version = number(versions[0]?.version) + 1
    const [result] = await connection.execute<ResultSetHeader>(
      "INSERT INTO vueshop_agent_prompt_version (version, content, status, created_by) VALUES (?, ?, 'draft', ?)",
      [version, content, adminId]
    )
    await connection.commit()
    return result.insertId
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function publishPrompt(id: number, adminId: number): Promise<void> {
  const connection = await db.getConnection()
  try {
    await connection.beginTransaction()
    const [rows] = await connection.execute<(RowDataPacket & { eval_score: string | null })[]>(
      'SELECT eval_score FROM vueshop_agent_prompt_version WHERE id = ? LIMIT 1 FOR UPDATE',
      [id]
    )
    const score = rows[0]?.eval_score
    if (score === undefined) throw new AppError('Prompt 版本不存在', 'PROMPT_NOT_FOUND')
    if (score === null || number(score) < 75) {
      throw new AppError('自动评测达到75分后才能发布', 'PROMPT_EVAL_REQUIRED')
    }
    await connection.execute(
      "UPDATE vueshop_agent_prompt_version SET status = 'archived' WHERE status = 'published'"
    )
    await connection.execute(
      "UPDATE vueshop_agent_prompt_version SET status = 'published', published_by = ?, published_at = NOW() WHERE id = ?",
      [adminId, id]
    )
    await connection.commit()
    invalidateAgentPromptCache()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

function toEvalCase(row: EvalCaseRow): AgentEvalCase {
  return {
    ...row,
    expected_keywords: stringArray(row.expected_keywords),
    forbidden_keywords: stringArray(row.forbidden_keywords),
    require_tool: row.require_tool === 1,
    enabled: row.enabled === 1
  }
}

export async function listEvalCases(): Promise<AgentEvalCase[]> {
  const [rows] = await db.execute<EvalCaseRow[]>(
    `SELECT id, name, question, expected_keywords, forbidden_keywords,
      require_tool, min_product_count, enabled, sort_order
     FROM vueshop_agent_eval_case ORDER BY sort_order ASC, id ASC`
  )
  return rows.map(toEvalCase)
}

export async function saveEvalCase(adminId: number, input: AgentEvalCaseInput): Promise<number> {
  const values = [input.name, input.question, JSON.stringify(input.expected_keywords),
    JSON.stringify(input.forbidden_keywords), input.require_tool ? 1 : 0,
    input.min_product_count, input.enabled ? 1 : 0, input.sort_order]
  if (input.id) {
    const [result] = await db.execute<ResultSetHeader>(
      `UPDATE vueshop_agent_eval_case SET name = ?, question = ?, expected_keywords = ?,
        forbidden_keywords = ?, require_tool = ?, min_product_count = ?, enabled = ?,
        sort_order = ?, updated_by = ? WHERE id = ?`,
      [...values, adminId, input.id]
    )
    if (result.affectedRows === 0) throw new AppError('评测用例不存在', 'EVAL_CASE_NOT_FOUND')
    return input.id
  }
  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO vueshop_agent_eval_case (
      name, question, expected_keywords, forbidden_keywords, require_tool,
      min_product_count, enabled, sort_order, created_by, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [...values, adminId, adminId]
  )
  return result.insertId
}

export async function runEvaluation(
  promptVersionId: number,
  adminId: number
): Promise<AgentEvalRunResult> {
  const [prompts] = await db.execute<(RowDataPacket & { id: number; content: string })[]>(
    'SELECT id, content FROM vueshop_agent_prompt_version WHERE id = ? LIMIT 1',
    [promptVersionId]
  )
  const prompt = prompts[0]
  if (!prompt) throw new AppError('Prompt 版本不存在', 'PROMPT_NOT_FOUND')
  const cases = (await listEvalCases()).filter(item => item.enabled).slice(0, 20)
  if (cases.length === 0) throw new AppError('请先启用至少一个评测用例', 'NO_EVAL_CASES')

  const results: AgentEvalCaseResult[] = []
  for (const item of cases) {
    try {
      const result = await runShopAgent(
        [{ role: 'user', content: item.question }],
        undefined,
        undefined,
        undefined,
        { id: prompt.id, content: prompt.content }
      )
      const reasons: string[] = []
      if (item.expected_keywords.some(keyword => !result.message.includes(keyword))) {
        reasons.push('缺少预期关键词')
      }
      if (item.forbidden_keywords.some(keyword => result.message.includes(keyword))) {
        reasons.push('包含禁止关键词')
      }
      if (item.require_tool && result.toolCalls === 0) reasons.push('未调用工具')
      if (result.products.length < item.min_product_count) reasons.push('商品数量不足')
      results.push({
        case_id: item.id,
        name: item.name,
        passed: reasons.length === 0,
        answer: result.message.slice(0, 1000),
        reasons
      })
    } catch (error: unknown) {
      results.push({
        case_id: item.id,
        name: item.name,
        passed: false,
        answer: '',
        reasons: [error instanceof Error ? error.message : '评测执行失败']
      })
    }
  }

  const passed = results.filter(item => item.passed).length
  const score = Math.round(passed / results.length * 10000) / 100
  await db.execute(
    `INSERT INTO vueshop_agent_eval_run (
      prompt_version_id, score, passed_count, total_count, results, operator_id
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [promptVersionId, score, passed, results.length, JSON.stringify(results), adminId]
  )
  await db.execute(
    'UPDATE vueshop_agent_prompt_version SET eval_score = ? WHERE id = ?',
    [score, promptVersionId]
  )
  return { prompt_version_id: promptVersionId, passed, total: results.length, score, results }
}

export async function saveFeedback(
  input: AgentFeedbackInput,
  userId: number | undefined,
  requestKey: string
): Promise<void> {
  const requestKeyHash = hashAgentRequestKey(requestKey)
  const [calls] = await db.execute<AgentCallOwnerRow[]>(
    `SELECT request_key_hash, user_id FROM vueshop_agent_call_log
     WHERE request_id = ? LIMIT 1`,
    [input.request_id]
  )
  const call = calls[0]
  if (!call) throw new AppError('回答记录不存在或尚未完成', 'AGENT_CALL_NOT_FOUND')
  if (call.request_key_hash !== requestKeyHash || call.user_id !== (userId ?? null)) {
    throw new AppError('无权评价这条回答', 'AGENT_FEEDBACK_FORBIDDEN')
  }
  await db.execute(
    `
      INSERT INTO vueshop_agent_feedback (
        request_id, request_key_hash, user_id, rating, category, comment
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE rating = VALUES(rating), category = VALUES(category),
        comment = VALUES(comment), updated_at = NOW()
    `,
    [input.request_id, requestKeyHash, userId ?? null,
      input.rating, input.category ?? '', input.comment ?? '']
  )
}
