import { createHash } from 'node:crypto'
import type { GovernanceQuery, GovernancePage, GovernancePreview, GovernanceRecordDetail, GovernanceTab } from '../../../shared/api'
import type { PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type {
  EnforcementAction,
  EnforcementGoods,
  EnforcementInput,
  EnforcementRecord,
  EnforcementScene,
  MerchantApplication,
  ReviewRecord
} from '../../../shared/api'
import type { AuthIdentity } from '../types'
import db from '../db'
import { AppError } from '../utils/input'

type OperatorRow = RowDataPacket & { username: string; role: 'admin' | 'reviewer' }
type ReasonRow = RowDataPacket & { id: number; label: string }
type GoodsRow = RowDataPacket & Omit<EnforcementGoods, 'price'> & { price: string }
type LockedGoodsRow = RowDataPacket & {
  id: number; merchant_id: number; user_id: number; merchant_name: string; name: string
  sale_status: string; compliance_status: string; category_id: number; price: string
  stock: number; picture: string; spec: string; description: string; version_id: number
}
type LockedMerchantRow = RowDataPacket & {
  id: number; user_id: number; shop_name: string; status: string; contact_name: string
  contact_phone: string; description: string; qualification_picture: string; version_id: number
}
type ReviewRecordRow = RowDataPacket & Omit<ReviewRecord, 'reason_snapshot'> & { reason_snapshot: unknown }
type EnforcementRecordRow = RowDataPacket & Omit<EnforcementRecord, 'reason_snapshot'> & { reason_snapshot: unknown }

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string')
  if (typeof value !== 'string') return []
  try { return stringArray(JSON.parse(value)) } catch { return [] }
}

async function operator(connection: PoolConnection, identity: AuthIdentity): Promise<OperatorRow> {
  const [rows] = await connection.execute<OperatorRow[]>(
    'SELECT username, role FROM vueshop_admin WHERE id = ? AND status = 1 LIMIT 1', [identity.id]
  )
  if (!rows[0] || (rows[0].role !== 'admin' && rows[0].role !== 'reviewer')) throw new AppError('后台账号不存在、已停用或角色无效', 'ADMIN_INACTIVE')
  return rows[0]
}

async function reasons(connection: PoolConnection, scene: EnforcementScene, ids: number[], note: string) {
  if (!ids.length && !note) throw new AppError('请选择违规原因或填写补充说明', 'ENFORCEMENT_REASON_REQUIRED')
  let labels: string[] = []
  if (ids.length) {
    const placeholders = ids.map(() => '?').join(',')
    const [rows] = await connection.execute<ReasonRow[]>(
      `SELECT id, label FROM vueshop_rejection_reason
       WHERE scene = ? AND enabled = 1 AND id IN (${placeholders})`, [scene, ...ids]
    )
    if (rows.length !== new Set(ids).size) throw new AppError('包含无效的违规原因', 'INVALID_ENFORCEMENT_REASON')
    labels = rows.map(row => row.label)
  }
  if (labels.includes('其他原因') && !note) throw new AppError('选择其他原因时必须填写补充说明', 'OTHER_REASON_NOTE_REQUIRED')
  const parts = labels.length ? [`原因：${labels.join('；')}`] : []
  if (note) parts.push(`补充说明：${note}`)
  return { labels, message: parts.join('。') }
}

export async function listGoods(query: GovernanceQuery): Promise<GovernancePage<EnforcementGoods>> {
  const result = await page<GoodsRow>(`
    SELECT g.id, g.merchant_id, g.category_id, g.name, g.price, g.picture, g.stock,
      g.sale_status, g.compliance_status, g.compliance_reason, g.spec, g.description,
      g.enforced_at, m.shop_name AS merchant_name, m.user_id, a.username AS enforcer_name
    FROM vueshop_goods AS g
    INNER JOIN vueshop_merchant AS m ON m.id = g.merchant_id
    LEFT JOIN vueshop_admin AS a ON a.id = g.enforced_by
    ORDER BY g.id DESC
  `, query, 'goods')
  return { ...result, list: result.list.map(row => ({ ...row, price: Number(row.price) })) }
}

export async function listMerchants(query: GovernanceQuery): Promise<GovernancePage<MerchantApplication>> {
  const result = await page<(RowDataPacket & MerchantApplication)>(`
    SELECT m.id, m.user_id, u.username, m.shop_name, m.contact_name, m.contact_phone,
      m.description, m.qualification_picture, m.status, m.rejection_reason,
      m.enforcement_reason, m.enforced_at, m.submitted_at, m.reviewed_at,
      reviewer.username AS reviewer_name, enforcer.username AS enforcer_name
    FROM vueshop_merchant AS m
    INNER JOIN vueshop_user AS u ON u.id = m.user_id
    LEFT JOIN vueshop_admin AS reviewer ON reviewer.id = m.reviewed_by
    LEFT JOIN vueshop_admin AS enforcer ON enforcer.id = m.enforced_by
    ORDER BY m.id DESC
  `, query, 'merchants')
  return result
}

export async function listReviewRecords(query: GovernanceQuery): Promise<GovernancePage<ReviewRecord>> {
  const result = await page<ReviewRecordRow>(`
    SELECT r.id, r.business_type, r.business_id,
      CASE WHEN r.business_type = 'merchant_application' THEN COALESCE(
        JSON_UNQUOTE(JSON_EXTRACT(r.business_snapshot, '$.shop_name')), m.shop_name, CONCAT('店铺 #', r.business_id))
        ELSE COALESCE(JSON_UNQUOTE(JSON_EXTRACT(r.business_snapshot, '$.name')), s.name,
          CONCAT('商品提交 #', r.business_id)) END AS business_name,
      COALESCE(JSON_UNQUOTE(JSON_EXTRACT(r.business_snapshot, '$.merchant_name')), shop.shop_name) AS merchant_name,
      r.record_source, r.decision, r.reason_snapshot, r.additional_note,
      COALESCE(NULLIF(r.reviewer_name_snapshot, ''), a.username, '未知账号') AS reviewer_name,
      COALESCE(NULLIF(r.reviewer_role_snapshot, ''), a.role, 'reviewer') AS reviewer_role,
      r.created_at
    FROM vueshop_review_record AS r
    LEFT JOIN vueshop_merchant AS m ON r.business_type = 'merchant_application' AND m.id = r.business_id
    LEFT JOIN vueshop_goods_submission AS s ON r.business_type = 'goods_submission' AND s.id = r.business_id
    LEFT JOIN vueshop_merchant AS shop ON shop.id = COALESCE(r.merchant_id, s.merchant_id, m.id)
    LEFT JOIN vueshop_admin AS a ON a.id = r.reviewer_id
    ORDER BY r.id DESC
  `, query, 'reviews')
  return { ...result, list: result.list.map(row => ({ ...row, reason_snapshot: stringArray(row.reason_snapshot) })) }
}

export async function listEnforcementRecords(query: GovernanceQuery): Promise<GovernancePage<EnforcementRecord>> {
  const result = await page<EnforcementRecordRow>(`
    SELECT e.id, e.business_type, e.business_id,
      COALESCE(JSON_UNQUOTE(JSON_EXTRACT(e.business_snapshot, '$.name')),
        JSON_UNQUOTE(JSON_EXTRACT(e.business_snapshot, '$.shop_name')), CONCAT('#', e.business_id)) AS business_name,
      e.merchant_id, COALESCE(JSON_UNQUOTE(JSON_EXTRACT(e.business_snapshot, '$.merchant_name')),
        JSON_UNQUOTE(JSON_EXTRACT(e.business_snapshot, '$.shop_name')), m.shop_name) AS merchant_name,
      e.parent_record_id, e.action, e.previous_status, e.next_status, e.reason_snapshot, e.additional_note,
      e.operator_name_snapshot AS operator_name, e.operator_role_snapshot AS operator_role, e.created_at
    FROM vueshop_enforcement_record AS e
    LEFT JOIN vueshop_merchant AS m ON m.id = e.merchant_id
    ORDER BY e.id DESC
  `, query, 'records')
  return { ...result, list: result.list.map(row => ({ ...row, reason_snapshot: stringArray(row.reason_snapshot) })) }
}

async function insertRecord(
  connection: PoolConnection,
  input: EnforcementInput,
  merchantId: number,
  userId: number,
  previousStatus: string,
  nextStatus: string,
  labels: string[],
  snapshot: object,
  identity: AuthIdentity,
  admin: OperatorRow,
  parentId: number | null = null
) {
  const [result] = await connection.execute<ResultSetHeader>(`
    INSERT INTO vueshop_enforcement_record
      (business_type, business_id, merchant_id, user_id, action, previous_status, next_status,
       reason_ids, reason_snapshot, additional_note, business_snapshot, operator_id,
       operator_name_snapshot, operator_role_snapshot, parent_record_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [input.business_type, input.business_id, merchantId, userId, input.action, previousStatus,
    nextStatus, JSON.stringify(input.reason_ids), JSON.stringify(labels), input.additional_note,
    JSON.stringify(snapshot), identity.id, admin.username, admin.role, parentId])
  return result.insertId
}

export async function enforce(identity: AuthIdentity, input: EnforcementInput): Promise<void> {
  const connection = await db.getConnection()
  try {
    await connection.beginTransaction()
    const admin = await operator(connection, identity)
    if ((input.action === 'revoke' || input.action === 'restore') && admin.role !== 'admin') {
      throw new AppError('仅管理员可以撤销资质或恢复经营', 'GOVERNANCE_FORBIDDEN')
    }
    if (input.action === 'restore' && !input.additional_note.trim()) throw new AppError('请填写恢复经营依据', 'RESTORE_NOTE_REQUIRED')
    if (input.business_type === 'goods') await enforceGoods(connection, identity, admin, input)
    else await enforceMerchant(connection, identity, admin, input)
    await connection.commit()
  } catch (error) { await connection.rollback(); throw error }
  finally { connection.release() }
}

async function enforceGoods(connection: PoolConnection, identity: AuthIdentity, admin: OperatorRow, input: EnforcementInput) {
  if (input.action !== 'force_off_sale') throw new AppError('商品处置动作不正确', 'INVALID_GOODS_ACTION')
  const [rows] = await connection.execute<LockedGoodsRow[]>(`
    SELECT g.id, g.merchant_id, m.user_id, m.shop_name AS merchant_name, g.name, g.sale_status,
      g.compliance_status, g.category_id, g.price, g.stock, g.picture, g.spec, g.description,
      g.governance_version AS version_id
    FROM vueshop_goods AS g INNER JOIN vueshop_merchant AS m ON m.id = g.merchant_id
    WHERE g.id = ? FOR UPDATE
  `, [input.business_id])
  const goods = rows[0]
  if (!goods) throw new AppError('商家商品不存在', 'MERCHANT_GOODS_NOT_FOUND')
  assertVersion(goods, input)
  if (goods.compliance_status === 'forced_off_sale') throw new AppError('该商品已经被平台下架', 'GOODS_ALREADY_ENFORCED')
  const reason = await reasons(connection, 'goods_enforcement', input.reason_ids, input.additional_note)
  await connection.execute(`UPDATE vueshop_goods SET governance_version = governance_version + 1, sale_status = 'off_sale', compliance_status = 'forced_off_sale',
    compliance_reason = ?, enforced_at = NOW(), enforced_by = ? WHERE id = ?`, [reason.message, identity.id, goods.id])
  await insertRecord(connection, input, goods.merchant_id, goods.user_id,
    `${goods.sale_status}/${goods.compliance_status}`, 'off_sale/forced_off_sale', reason.labels, goods, identity, admin)
  await connection.execute(`INSERT INTO vueshop_notification
    (user_id, type, title, content, business_type, business_id) VALUES (?, 'goods_forced_off_sale', ?, ?, 'goods', ?)`,
  [goods.user_id, '商品已被平台下架', `商品“${goods.name}”已被平台强制下架。${reason.message}。请整改后重新提交审核。`, goods.id])
}

async function enforceMerchant(connection: PoolConnection, identity: AuthIdentity, admin: OperatorRow, input: EnforcementInput) {
  const [rows] = await connection.execute<LockedMerchantRow[]>(`
    SELECT id, user_id, shop_name, status, contact_name, contact_phone, description, qualification_picture,
      governance_version AS version_id
    FROM vueshop_merchant WHERE id = ? FOR UPDATE
  `, [input.business_id])
  const merchant = rows[0]
  if (!merchant) throw new AppError('店铺不存在', 'MERCHANT_NOT_FOUND')
  assertVersion(merchant, input)
  if (input.action === 'revoke' && input.confirmation_name !== merchant.shop_name) throw new AppError('请输入完整店铺名称确认撤销', 'CONFIRMATION_REQUIRED')
  let nextStatus: 'suspended' | 'revoked' | 'approved'
  if (input.action === 'suspend' && merchant.status === 'approved') nextStatus = 'suspended'
  else if (input.action === 'revoke' && (merchant.status === 'approved' || merchant.status === 'suspended')) nextStatus = 'revoked'
  else if (input.action === 'restore' && merchant.status === 'suspended') nextStatus = 'approved'
  else throw new AppError('当前店铺状态不能执行该操作', 'INVALID_MERCHANT_TRANSITION')
  const reason = input.action === 'restore'
    ? { labels: [] as string[], message: input.additional_note }
    : await reasons(connection, 'merchant_enforcement', input.reason_ids, input.additional_note)
  await connection.execute(`UPDATE vueshop_merchant SET governance_version = governance_version + 1, status = ?, enforcement_reason = ?, enforced_at = NOW(),
    enforced_by = ? WHERE id = ?`, [nextStatus, nextStatus === 'approved' ? '' : reason.message, identity.id, merchant.id])
  const [previous] = await connection.execute<(RowDataPacket & { id: number })[]>(
    "SELECT id FROM vueshop_enforcement_record WHERE business_type = 'merchant' AND business_id = ? AND action = 'suspend' ORDER BY id DESC LIMIT 1", [merchant.id])
  const parentId = await insertRecord(connection, input, merchant.id, merchant.user_id, merchant.status, nextStatus,
    reason.labels, merchant, identity, admin, input.action === 'restore' ? previous[0]?.id ?? null : null)
  if (input.action === 'suspend' || input.action === 'revoke') {
    const [affected] = await connection.execute<(RowDataPacket & { id: number; sale_status: string; compliance_status: string })[]>(
      'SELECT * FROM vueshop_goods WHERE merchant_id = ? ORDER BY id FOR UPDATE', [merchant.id])
    for (const item of affected) {
      await insertRecord(connection, { ...input, business_type: 'goods', business_id: item.id }, merchant.id, merchant.user_id,
        `${item.sale_status}/${item.compliance_status}`, `off_sale/${input.action === 'revoke' ? 'forced_off_sale' : item.compliance_status}`,
        reason.labels, { ...item, merchant_name: merchant.shop_name }, identity, admin, parentId)
    }
    if (input.action === 'revoke') {
      const [pending] = await connection.execute<(RowDataPacket & { id: number; goods_id: number | null })[]>(
        "SELECT * FROM vueshop_goods_submission WHERE merchant_id = ? AND status = 'pending' ORDER BY id FOR UPDATE", [merchant.id])
      for (const item of pending) {
        await connection.execute(`INSERT INTO vueshop_review_record
          (business_type, business_id, business_snapshot, related_goods_id, merchant_id, decision,
           reason_ids, reason_snapshot, additional_note, reviewer_id, reviewer_name_snapshot, reviewer_role_snapshot,
           enforcement_record_id, record_source)
          VALUES ('goods_submission', ?, ?, ?, ?, 'rejected', ?, ?, ?, ?, ?, ?, ?, 'enforcement')`,
          [item.id, JSON.stringify({ ...item, merchant_name: merchant.shop_name }), item.goods_id, merchant.id,
            JSON.stringify(input.reason_ids), JSON.stringify(reason.labels), input.additional_note,
            identity.id, admin.username, admin.role, parentId])
      }
    }
  }
  if (input.action === 'suspend') {
    await connection.execute("UPDATE vueshop_goods SET governance_version = governance_version + 1, sale_status = 'off_sale' WHERE merchant_id = ?", [merchant.id])
  } else if (input.action === 'revoke') {
    await connection.execute(`UPDATE vueshop_goods SET governance_version = governance_version + 1, sale_status = 'off_sale', compliance_status = 'forced_off_sale',
      compliance_reason = ?, enforced_at = NOW(), enforced_by = ? WHERE merchant_id = ?`,
    [`店铺资质已撤销。${reason.message}`, identity.id, merchant.id])
    await connection.execute(`UPDATE vueshop_goods_submission SET status = 'rejected', rejection_reason = ?,
      reviewed_at = NOW(), reviewed_by = ? WHERE merchant_id = ? AND status = 'pending'`,
    [`店铺资质已撤销。${reason.message}`, identity.id, merchant.id])
  }
  const type = input.action === 'suspend' ? 'merchant_suspended' : input.action === 'revoke' ? 'merchant_revoked' : 'merchant_restored'
  const title = input.action === 'suspend' ? '店铺已暂停经营' : input.action === 'revoke' ? '商家资质已撤销' : '店铺已恢复经营'
  const content = input.action === 'restore'
    ? `店铺“${merchant.shop_name}”已恢复经营资格，商品仍需重新上架；平台强制下架商品需整改复审。${reason.message}`
    : `店铺“${merchant.shop_name}”${input.action === 'suspend' ? '已被暂停经营' : '的商家资质已被撤销'}。${reason.message}`
  await connection.execute(`INSERT INTO vueshop_notification
    (user_id, type, title, content, business_type, business_id) VALUES (?, ?, ?, ?, 'merchant_application', ?)`,
  [merchant.user_id, type, title, content, merchant.id])
}

function versionOf(row: object): string {
  return createHash('sha256').update(JSON.stringify(Object.entries(row).sort(([a], [b]) => a.localeCompare(b)))).digest('hex')
}
function assertVersion(row: object, input: EnforcementInput) {
  if (versionOf(row) !== input.expected_version) throw new AppError('对象已发生变化，请关闭弹窗并刷新后重新确认', 'GOVERNANCE_STALE')
}
export async function preview(type: 'goods' | 'merchant', id: number): Promise<GovernancePreview> {
  const [rows] = type === 'goods'
    ? await db.execute<LockedGoodsRow[]>(`
    SELECT g.id, g.merchant_id, m.user_id, m.shop_name AS merchant_name, g.name, g.sale_status,
      g.compliance_status, g.category_id, g.price, g.stock, g.picture, g.spec, g.description,
      g.governance_version AS version_id
    FROM vueshop_goods AS g INNER JOIN vueshop_merchant AS m ON m.id = g.merchant_id
    WHERE g.id = ?
  `, [id])
    : await db.execute<LockedMerchantRow[]>(`
    SELECT id, user_id, shop_name, status, contact_name, contact_phone, description, qualification_picture,
      governance_version AS version_id
    FROM vueshop_merchant WHERE id = ?
  `, [id])
  const row = rows[0]
  if (!row) throw new AppError('处置对象不存在', 'TARGET_NOT_FOUND')
  const [counts] = await db.execute<(RowDataPacket & { goods_count: number; pending_count: number })[]>(`
    SELECT (SELECT COUNT(*) FROM vueshop_goods WHERE merchant_id = ?) AS goods_count,
      (SELECT COUNT(*) FROM vueshop_goods_submission WHERE merchant_id = ? AND status = 'pending') AS pending_count`, [id, id])
  return { version: versionOf(row), name: 'name' in row ? row.name : row.shop_name,
    status: 'sale_status' in row ? `${row.sale_status}/${row.compliance_status}` : row.status,
    goods_count: type === 'goods' ? 1 : Number(counts[0]?.goods_count ?? 0),
    pending_count: type === 'goods' ? 0 : Number(counts[0]?.pending_count ?? 0) }
}

async function page<T extends RowDataPacket>(sql: string, query: GovernanceQuery, tab: GovernanceTab): Promise<GovernancePage<T>> {
  const clauses: string[] = [], values: Array<string | number> = []
  const name = tab === 'goods' ? 'name' : tab === 'merchants' ? 'shop_name' : 'business_name'
  const id = tab === 'goods' || tab === 'merchants' ? 'id' : 'business_id'
  if (query.keyword) { clauses.push(`(${name} LIKE ? OR CAST(${id} AS CHAR) = ?)`); values.push(`%${query.keyword}%`, query.keyword) }
  if (query.merchant) { clauses.push(`${tab === 'merchants' ? 'shop_name' : 'merchant_name'} LIKE ?`); values.push(`%${query.merchant}%`) }
  if (query.status) {
    const column = tab === 'goods' ? 'compliance_status' : tab === 'merchants' ? 'status' : tab === 'reviews' ? 'decision' : 'action'
    if (tab === 'reviews' && query.status === 'terminated') clauses.push("record_source = 'enforcement'")
    else { clauses.push(`${column} = ?`); values.push(query.status); if (tab === 'reviews' && query.status === 'rejected') clauses.push("record_source = 'manual'") }
  }
  if (query.operator) {
    const column = tab === 'records' ? 'operator_name' : tab === 'reviews' ? 'reviewer_name' : 'enforcer_name'
    clauses.push(`${column} LIKE ?`); values.push(`%${query.operator}%`)
  }
  const dateColumn = tab === 'goods' || tab === 'merchants' ? 'enforced_at' : 'created_at'
  if (query.start_date) { clauses.push(`${dateColumn} >= ?`); values.push(query.start_date) }
  if (query.end_date) { clauses.push(`${dateColumn} < DATE_ADD(?, INTERVAL 1 DAY)`); values.push(query.end_date) }
  const from = `FROM (${sql.replace(/ORDER BY [a-z]+\.id DESC\s*$/, '')}) AS records ${clauses.length ? 'WHERE ' + clauses.join(' AND ') : ''}`
  const [counts] = await db.execute<(RowDataPacket & { total: number })[]>(`SELECT COUNT(*) AS total ${from}`, values)
  const [rows] = await db.execute<T[]>(`SELECT * ${from} ORDER BY id DESC LIMIT ${query.page_size} OFFSET ${(query.page - 1) * query.page_size}`, values)
  return { list: rows, total: Number(counts[0]?.total ?? 0) }
}
function jsonObject(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'string') { try { return jsonObject(JSON.parse(value)) } catch { return null } }
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : null
}
export async function detail(kind: 'reviews' | 'records', id: number): Promise<GovernanceRecordDetail> {
  type DetailRow = RowDataPacket & { id: number; business_type: string; business_id: number; merchant_id: number; business_snapshot: unknown; parent_id: number | null; source: string; related_goods_id: number | null }
  const [rows] = await db.execute<DetailRow[]>(kind === 'records'
    ? "SELECT *, parent_record_id AS parent_id, 'enforcement' AS source, NULL AS related_goods_id FROM vueshop_enforcement_record WHERE id = ?"
    : 'SELECT *, enforcement_record_id AS parent_id, record_source AS source FROM vueshop_review_record WHERE id = ?', [id])
  const row = rows[0]
  if (!row) throw new AppError('记录不存在', 'RECORD_NOT_FOUND')
  const table = row.business_type === 'goods' ? 'vueshop_goods' : row.business_type === 'goods_submission' ? 'vueshop_goods_submission' : 'vueshop_merchant'
  const [current] = await db.execute<RowDataPacket[]>(`SELECT * FROM ${table} WHERE id = ?`, [row.business_id])
  const [related] = await db.execute<(RowDataPacket & GovernanceRecordDetail['related'][number])[]>(`
    SELECT id, 'records' AS kind, COALESCE(JSON_UNQUOTE(JSON_EXTRACT(business_snapshot, '$.name')),
      JSON_UNQUOTE(JSON_EXTRACT(business_snapshot, '$.shop_name')), CONCAT('#', business_id)) AS name, action
    FROM vueshop_enforcement_record WHERE id = ? OR parent_record_id = ? OR
      (business_type = ? AND business_id = ?)
    UNION ALL
    SELECT id, 'reviews' AS kind, COALESCE(JSON_UNQUOTE(JSON_EXTRACT(business_snapshot, '$.name')),
      JSON_UNQUOTE(JSON_EXTRACT(business_snapshot, '$.shop_name')), CONCAT('#', business_id)) AS name,
      CASE WHEN record_source = 'enforcement' THEN 'terminated' ELSE decision END AS action
    FROM vueshop_review_record WHERE enforcement_record_id = ? OR
      (business_type = ? AND business_id = ?) OR (related_goods_id IS NOT NULL AND related_goods_id = ?)
    ORDER BY id DESC`, [row.parent_id, kind === 'records' ? id : row.parent_id,
      row.business_type === 'merchant_application' ? 'merchant' : row.business_type === 'goods_submission' ? 'goods' : row.business_type,
      row.business_type === 'goods_submission' ? row.related_goods_id ?? 0 : row.business_id, kind === 'records' ? id : row.parent_id,
      row.business_type === 'merchant' ? 'merchant_application' : row.business_type, row.business_id,
      row.business_type === 'goods' ? row.business_id : row.related_goods_id])
  return { id, record: { ...jsonObject(row), reason_snapshot: stringArray(row.reason_snapshot) }, snapshot: jsonObject(row.business_snapshot), current: current[0] ? jsonObject(current[0]) : null,
    related: related.filter(item => item.kind !== kind || item.id !== id), parent_id: row.parent_id, source: row.source }
}
