import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import type {
  GoodsSubmission,
  MerchantApplication,
  RejectionReasonOption,
  ReviewDecision,
  ReviewInput,
  ReviewScene,
  ReasonScene
} from '../../../shared/api'
import db from '../db'
import { AppError } from '../utils/input'
import { findSubmission } from './merchant'
import { notificationText } from './notification'

type ReasonRow = RowDataPacket & RejectionReasonOption
type MerchantReviewRow = RowDataPacket & MerchantApplication
type LockedMerchantRow = RowDataPacket & { id: number; user_id: number; shop_name: string; status: string; contact_name: string; contact_phone: string; description: string; qualification_picture: string; submitted_at: string }
type LockedSubmissionRow = RowDataPacket & {
  id: number; goods_id: number | null; merchant_id: number; user_id: number; name: string
  category_id: number; price: string; stock: number; picture: string; spec: string
  description: string; status: string; action: string; submitted_at: string; merchant_status: string
}
type AlbumRow = RowDataPacket & { picture: string }

export async function listReasons(scene: ReasonScene): Promise<RejectionReasonOption[]> {
  const [rows] = await db.execute<ReasonRow[]>(
    `SELECT id, scene, label FROM vueshop_rejection_reason
     WHERE scene = ? AND enabled = 1 ORDER BY sort_order, id`,
    [scene]
  )
  return rows
}

export async function listMerchants(status?: string): Promise<MerchantApplication[]> {
  const where = status ? 'WHERE m.status = ?' : ''
  const [rows] = await db.execute<MerchantReviewRow[]>(`
    SELECT m.id, m.user_id, u.username, m.shop_name, m.contact_name, m.contact_phone,
      m.description, m.qualification_picture, m.status, m.rejection_reason, m.enforcement_reason,
      m.enforced_at, m.submitted_at, m.reviewed_at, a.username AS reviewer_name,
      enforcer.username AS enforcer_name
    FROM vueshop_merchant AS m
    INNER JOIN vueshop_user AS u ON u.id = m.user_id
    LEFT JOIN vueshop_admin AS a ON a.id = m.reviewed_by
    LEFT JOIN vueshop_admin AS enforcer ON enforcer.id = m.enforced_by
    ${where} ORDER BY m.submitted_at DESC, m.id DESC
  `, status ? [status] : [])
  return rows
}

export async function listGoodsSubmissions(status?: string): Promise<GoodsSubmission[]> {
  const where = status ? 'WHERE s.status = ?' : ''
  const [ids] = await db.execute<(RowDataPacket & { id: number })[]>(`
    SELECT s.id FROM vueshop_goods_submission AS s ${where}
    ORDER BY COALESCE(s.submitted_at, s.updated_at) DESC, s.id DESC
  `, status ? [status] : [])
  const items = await Promise.all(ids.map(row => findSubmission(row.id)))
  return items.filter((item): item is GoodsSubmission => item !== null)
}

async function resolveReasons(
  connection: PoolConnection,
  scene: ReviewScene,
  decision: ReviewDecision,
  reasonIds: number[],
  additionalNote: string
): Promise<{ labels: string[]; message: string }> {
  if (decision === 'approved') return { labels: [], message: additionalNote }
  if (!reasonIds.length && !additionalNote) throw new AppError('拒绝时请选择常见原因或填写补充说明', 'REASON_REQUIRED')
  let labels: string[] = []
  if (reasonIds.length) {
    const placeholders = reasonIds.map(() => '?').join(',')
    const [rows] = await connection.execute<ReasonRow[]>(
      `SELECT id, scene, label FROM vueshop_rejection_reason
       WHERE scene = ? AND enabled = 1 AND id IN (${placeholders})`,
      [scene, ...reasonIds]
    )
    if (rows.length !== new Set(reasonIds).size) throw new AppError('包含无效的拒绝原因', 'INVALID_REASON')
    labels = rows.map(row => row.label)
  }
  if (labels.includes('其他原因') && !additionalNote) throw new AppError('选择其他原因时必须填写补充说明', 'OTHER_REASON_NOTE_REQUIRED')
  const parts = labels.length ? [`原因：${labels.join('；')}`] : []
  if (additionalNote) parts.push(`补充说明：${additionalNote}`)
  return { labels, message: parts.join('。') }
}

async function insertReviewRecord(
  connection: PoolConnection,
  scene: ReviewScene,
  businessId: number,
  reviewerId: number,
  input: ReviewInput,
  labels: string[],
  snapshot: object,
  merchantId: number,
  relatedGoodsId: number | null
) {
  await connection.execute(`
    INSERT INTO vueshop_review_record
      (business_type, business_id, business_snapshot, related_goods_id, merchant_id, decision,
       reason_ids, reason_snapshot, additional_note, reviewer_id, reviewer_name_snapshot, reviewer_role_snapshot)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, a.username, a.role FROM vueshop_admin AS a WHERE a.id = ?
  `, [scene, businessId, JSON.stringify(snapshot), relatedGoodsId, merchantId, input.decision,
    JSON.stringify(input.reason_ids), JSON.stringify(labels), input.additional_note, reviewerId, reviewerId])
}

export async function reviewMerchant(reviewerId: number, input: ReviewInput): Promise<void> {
  const connection = await db.getConnection()
  try {
    await connection.beginTransaction()
    const [rows] = await connection.execute<LockedMerchantRow[]>(
      `SELECT id, user_id, shop_name, status, contact_name, contact_phone, description,
        qualification_picture, submitted_at FROM vueshop_merchant WHERE id = ? FOR UPDATE`,
      [input.id]
    )
    const merchant = rows[0]
    if (!merchant) throw new AppError('商家申请不存在', 'MERCHANT_NOT_FOUND')
    if (merchant.status !== 'pending') throw new AppError('该申请已由其他审核人员处理，请刷新后查看', 'ALREADY_REVIEWED')
    const reason = await resolveReasons(connection, 'merchant_application', input.decision,
      input.reason_ids, input.additional_note)
    const status = input.decision
    await connection.execute(`
      UPDATE vueshop_merchant SET status = ?, rejection_reason = ?, reviewed_at = NOW(), reviewed_by = ?
      WHERE id = ? AND status = 'pending'
    `, [status, input.decision === 'rejected' ? reason.message : '', reviewerId, input.id])
    await insertReviewRecord(connection, 'merchant_application', input.id, reviewerId, input, reason.labels,
      merchant, merchant.id, null)
    const type = input.decision === 'approved' ? 'merchant_application_approved' : 'merchant_application_rejected'
    const notice = notificationText(type, merchant.shop_name, reason.message)
    await connection.execute(`
      INSERT INTO vueshop_notification (user_id, type, title, content, business_type, business_id)
      VALUES (?, ?, ?, ?, 'merchant_application', ?)
    `, [merchant.user_id, type, notice.title, notice.content, merchant.id])
    await connection.commit()
  } catch (error) { await connection.rollback(); throw error }
  finally { connection.release() }
}

async function copyAlbumToGoods(connection: PoolConnection, submissionId: number, goodsId: number) {
  const [album] = await connection.execute<AlbumRow[]>(
    'SELECT picture FROM vueshop_goods_submission_album WHERE submission_id = ? ORDER BY id',
    [submissionId]
  )
  await connection.execute('DELETE FROM vueshop_goods_album WHERE goods_id = ?', [goodsId])
  if (!album.length) return
  const placeholders = album.map(() => '(?, ?)').join(',')
  await connection.execute(
    `INSERT INTO vueshop_goods_album (goods_id, picture) VALUES ${placeholders}`,
    album.flatMap(item => [goodsId, item.picture])
  )
}

export async function reviewGoods(reviewerId: number, input: ReviewInput): Promise<number | null> {
  const connection = await db.getConnection()
  try {
    await connection.beginTransaction()
    const [rows] = await connection.execute<LockedSubmissionRow[]>(`
      SELECT s.id, s.goods_id, s.merchant_id, m.user_id, s.name, s.category_id, s.price,
        s.stock, s.picture, s.spec, s.description, s.status, s.action, s.submitted_at,
        m.status AS merchant_status
      FROM vueshop_goods_submission AS s
      INNER JOIN vueshop_merchant AS m ON m.id = s.merchant_id
      WHERE s.id = ? FOR UPDATE
    `, [input.id])
    const item = rows[0]
    if (!item) throw new AppError('商品提交不存在', 'SUBMISSION_NOT_FOUND')
    if (item.status !== 'pending') throw new AppError('该商品已由其他审核人员处理，请刷新后查看', 'ALREADY_REVIEWED')
    if (item.merchant_status !== 'approved') throw new AppError('店铺已暂停经营或资质已撤销，不能审核商品', 'MERCHANT_NOT_ACTIVE')
    const reason = await resolveReasons(connection, 'goods_submission', input.decision,
      input.reason_ids, input.additional_note)
    let goodsId = item.goods_id
    if (input.decision === 'approved') {
      if (item.action === 'create') {
        const [result] = await connection.execute<ResultSetHeader>(`
          INSERT INTO vueshop_goods
            (merchant_id, category_id, name, price, picture, stock, sale_status, spec, description)
          VALUES (?, ?, ?, ?, ?, ?, 'on_sale', ?, ?)
        `, [item.merchant_id, item.category_id, item.name, item.price, item.picture,
          item.stock, item.spec, item.description])
        goodsId = result.insertId
      } else {
        if (!goodsId) throw new AppError('待修改商品不存在', 'GOODS_NOT_FOUND')
        const [result] = await connection.execute<ResultSetHeader>(`
          UPDATE vueshop_goods SET sale_status = IF(compliance_status = 'forced_off_sale', 'on_sale', sale_status),
            compliance_status = 'normal', compliance_reason = '', enforced_at = NULL, enforced_by = NULL,
            category_id = ?, name = ?, price = ?, picture = ?, spec = ?, description = ?
          WHERE id = ? AND merchant_id = ?
        `, [item.category_id, item.name, item.price, item.picture, item.spec, item.description,
          goodsId, item.merchant_id])
        if (!result.affectedRows) throw new AppError('待修改商品不存在', 'GOODS_NOT_FOUND')
      }
      await copyAlbumToGoods(connection, item.id, goodsId)
    }
    await connection.execute(`
      UPDATE vueshop_goods_submission SET goods_id = ?, status = ?, rejection_reason = ?,
        reviewed_at = NOW(), reviewed_by = ? WHERE id = ? AND status = 'pending'
    `, [goodsId, input.decision, input.decision === 'rejected' ? reason.message : '', reviewerId, input.id])
    await insertReviewRecord(connection, 'goods_submission', input.id, reviewerId, input, reason.labels,
      item, item.merchant_id, goodsId)
    const type = input.decision === 'approved' ? 'goods_approved' : 'goods_rejected'
    const notice = notificationText(type, item.name, reason.message)
    await connection.execute(`
      INSERT INTO vueshop_notification (user_id, type, title, content, business_type, business_id)
      VALUES (?, ?, ?, ?, 'goods_submission', ?)
    `, [item.user_id, type, notice.title, notice.content, item.id])
    await connection.commit()
    return goodsId
  } catch (error) { await connection.rollback(); throw error }
  finally { connection.release() }
}
