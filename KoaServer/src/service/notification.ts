import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import type { NotificationItem, NotificationType } from '../../../shared/api'
import db from '../db'

type NotificationRow = RowDataPacket & NotificationItem
type CountRow = RowDataPacket & { count: number | string }

export async function list(userId: number, page: number, pagesize: number, unreadOnly: boolean) {
  const where = unreadOnly ? 'AND read_at IS NULL' : ''
  const [rows] = await db.execute<NotificationRow[]>(`
    SELECT id, type, title, content, business_type, business_id, read_at, created_at
    FROM vueshop_notification WHERE user_id = ? ${where}
    ORDER BY id DESC LIMIT ? OFFSET ?
  `, [userId, pagesize, (page - 1) * pagesize])
  const [counts] = await db.execute<CountRow[]>(
    `SELECT COUNT(*) AS count FROM vueshop_notification WHERE user_id = ? ${where}`,
    [userId]
  )
  return { list: rows, total: Number(counts[0]?.count ?? 0) }
}

export async function unreadCount(userId: number): Promise<number> {
  const [rows] = await db.execute<CountRow[]>(
    'SELECT COUNT(*) AS count FROM vueshop_notification WHERE user_id = ? AND read_at IS NULL',
    [userId]
  )
  return Number(rows[0]?.count ?? 0)
}

export async function markRead(userId: number, id: number): Promise<boolean> {
  const [result] = await db.execute<ResultSetHeader>(
    'UPDATE vueshop_notification SET read_at = COALESCE(read_at, NOW()) WHERE id = ? AND user_id = ?',
    [id, userId]
  )
  return result.affectedRows > 0
}

export async function markAllRead(userId: number): Promise<void> {
  await db.execute('UPDATE vueshop_notification SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL', [userId])
}

export function notificationText(
  type: NotificationType,
  name: string,
  reason: string
): { title: string; content: string } {
  if (type === 'merchant_application_approved') return { title: '商家申请已通过', content: `你的店铺“${name}”已通过审核，现在可以进入商家中心提交商品。` }
  if (type === 'merchant_application_rejected') return { title: '商家申请未通过', content: `你的店铺“${name}”未通过审核。${reason}` }
  if (type === 'goods_approved') return { title: '商品审核已通过', content: `你提交的商品“${name}”已通过审核。` }
  if (type === 'goods_rejected') return { title: '商品审核未通过', content: `你提交的商品“${name}”未通过审核。${reason}` }
  return { title: '商家状态发生变化', content: reason }
}
