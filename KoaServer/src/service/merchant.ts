import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import type {
  GoodsSubmission,
  GoodsSubmissionInput,
  MerchantApplication,
  MerchantApplicationSubmitInput,
  MerchantGoodsItem,
  MerchantStatus,
  MerchantOrder,
  OrderStatus,
  ShipMerchantOrderInput
} from '../../../shared/api'
import type { MerchantState } from '../types'
import db from '../db'
import { AppError } from '../utils/input'

type MerchantRow = RowDataPacket & MerchantApplication
type MerchantStateRow = RowDataPacket & MerchantState
type SubmissionRow = RowDataPacket & Omit<GoodsSubmission, 'price' | 'album'> & { price: string }
type AlbumPathRow = RowDataPacket & { picture: string }
type MerchantGoodsRow = RowDataPacket & Omit<MerchantGoodsItem, 'price'> & { price: string }
type MerchantOrderRow = RowDataPacket & {
  id: number; order_no: string; status: string; total_amount: string; receiver_name: string
  receiver_phone: string; receiver_address: string; created_at: Date | string
  payment_expires_at: Date | string | null; paid_at: Date | string | null
  shipped_at: Date | string | null; completed_at: Date | string | null
  item_id: number; goods_id: number; goods_name: string; goods_picture: string; goods_spec: string
  unit_price: string; quantity: number; subtotal: string; merchant_id: number | null
  merchant_name: string | null; fulfillment_status: string; shipping_carrier: string
  tracking_no: string; item_shipped_at: Date | string | null
}

const merchantStatuses: MerchantStatus[] = ['pending', 'approved', 'rejected', 'suspended', 'revoked']
const parseMerchant = (row: MerchantRow): MerchantApplication => ({
  ...row,
  status: merchantStatuses.find(status => status === row.status) ?? 'pending'
})

export async function listApplicationsByUserId(userId: number): Promise<MerchantApplication[]> {
  const [rows] = await db.execute<MerchantRow[]>(`
    SELECT m.id, m.user_id, u.username, m.shop_name, m.contact_name, m.contact_phone,
      m.description, m.qualification_picture, m.status, m.rejection_reason, m.enforcement_reason,
      m.enforced_at, m.submitted_at, m.reviewed_at, a.username AS reviewer_name,
      enforcer.username AS enforcer_name
    FROM vueshop_merchant AS m
    INNER JOIN vueshop_user AS u ON u.id = m.user_id
    LEFT JOIN vueshop_admin AS a ON a.id = m.reviewed_by
    LEFT JOIN vueshop_admin AS enforcer ON enforcer.id = m.enforced_by
    WHERE m.user_id = ?
    ORDER BY m.created_at DESC, m.id DESC
  `, [userId])
  return rows.map(parseMerchant)
}

export async function findApprovedByUserId(userId: number, merchantId: number): Promise<MerchantState | null> {
  const [rows] = await db.execute<MerchantStateRow[]>(
    `SELECT id, user_id, shop_name, status FROM vueshop_merchant
     WHERE id = ? AND user_id = ? AND status = 'approved' LIMIT 1`,
    [merchantId, userId]
  )
  return rows[0] ?? null
}

export async function submitApplication(userId: number, input: MerchantApplicationSubmitInput): Promise<number> {
  if (input.id !== undefined) {
    const applications = await listApplicationsByUserId(userId)
    const current = applications.find(item => item.id === input.id)
    if (!current) throw new AppError('店铺申请不存在', 'MERCHANT_NOT_FOUND')
    if (current.status !== 'rejected') throw new AppError('只有被拒绝的申请可以重新提交', 'MERCHANT_NOT_REJECTED')
    await db.execute(`
      UPDATE vueshop_merchant SET shop_name = ?, contact_name = ?, contact_phone = ?,
        description = ?, qualification_picture = ?, status = 'pending', rejection_reason = '',
        submitted_at = NOW(), reviewed_at = NULL, reviewed_by = NULL
      WHERE id = ?
    `, [input.shop_name, input.contact_name, input.contact_phone, input.description,
      input.qualification_picture, input.id])
    return current.id
  }

  const [result] = await db.execute<ResultSetHeader>(`
    INSERT INTO vueshop_merchant
      (user_id, shop_name, contact_name, contact_phone, description, qualification_picture, status)
    VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `, [userId, input.shop_name, input.contact_name, input.contact_phone,
    input.description, input.qualification_picture])
  return result.insertId
}

async function insertSubmissionAlbum(connection: PoolConnection, submissionId: number, album: string[]) {
  if (!album.length) return
  const placeholders = album.map(() => '(?, ?)').join(', ')
  const values = album.flatMap(picture => [submissionId, picture])
  await connection.execute(
    `INSERT INTO vueshop_goods_submission_album (submission_id, picture) VALUES ${placeholders}`,
    values
  )
}

async function getAlbum(submissionId: number): Promise<string[]> {
  const [rows] = await db.execute<AlbumPathRow[]>(
    'SELECT picture FROM vueshop_goods_submission_album WHERE submission_id = ? ORDER BY id',
    [submissionId]
  )
  return rows.map(row => row.picture)
}

async function hydrateSubmission(row: SubmissionRow): Promise<GoodsSubmission> {
  return { ...row, price: Number(row.price), album: await getAlbum(row.id) }
}

export async function listSubmissions(merchantId: number): Promise<GoodsSubmission[]> {
  const [rows] = await db.execute<SubmissionRow[]>(`
    SELECT s.*, m.shop_name AS merchant_name, a.username AS reviewer_name
    FROM vueshop_goods_submission AS s
    INNER JOIN vueshop_merchant AS m ON m.id = s.merchant_id
    LEFT JOIN vueshop_admin AS a ON a.id = s.reviewed_by
    WHERE s.merchant_id = ? ORDER BY s.updated_at DESC, s.id DESC
  `, [merchantId])
  return Promise.all(rows.map(hydrateSubmission))
}

export async function findSubmission(id: number, merchantId?: number): Promise<GoodsSubmission | null> {
  const values: number[] = [id]
  const ownerClause = merchantId === undefined ? '' : 'AND s.merchant_id = ?'
  if (merchantId !== undefined) values.push(merchantId)
  const [rows] = await db.execute<SubmissionRow[]>(`
    SELECT s.*, m.shop_name AS merchant_name, a.username AS reviewer_name
    FROM vueshop_goods_submission AS s
    INNER JOIN vueshop_merchant AS m ON m.id = s.merchant_id
    LEFT JOIN vueshop_admin AS a ON a.id = s.reviewed_by
    WHERE s.id = ? ${ownerClause} LIMIT 1
  `, values)
  return rows[0] ? hydrateSubmission(rows[0]) : null
}

export async function saveSubmission(
  merchantId: number,
  input: Omit<GoodsSubmissionInput, 'price'> & { price: string }
): Promise<number> {
  const connection = await db.getConnection()
  try {
    await connection.beginTransaction()
    let submissionId: number
    if (input.id) {
      const [rows] = await connection.execute<(RowDataPacket & { status: string })[]>(
        'SELECT status FROM vueshop_goods_submission WHERE id = ? AND merchant_id = ? FOR UPDATE',
        [input.id, merchantId]
      )
      if (!rows[0]) throw new AppError('商品草稿不存在', 'SUBMISSION_NOT_FOUND')
      if (!['draft', 'rejected'].includes(rows[0].status)) {
        throw new AppError('当前状态不能修改', 'SUBMISSION_NOT_EDITABLE')
      }
      if (input.goods_id) {
        const [goods] = await connection.execute<RowDataPacket[]>(
          'SELECT id FROM vueshop_goods WHERE id = ? AND merchant_id = ? LIMIT 1',
          [input.goods_id, merchantId]
        )
        if (!goods[0]) throw new AppError('商品不存在或不属于当前商家', 'GOODS_NOT_OWNED')
      }
      await connection.execute(`
        UPDATE vueshop_goods_submission SET goods_id = ?, action = ?, name = ?, category_id = ?,
          price = ?, stock = ?, picture = ?, spec = ?, description = ?, status = 'draft',
          rejection_reason = '', reviewed_at = NULL, reviewed_by = NULL
        WHERE id = ? AND merchant_id = ?
      `, [input.goods_id ?? null, input.goods_id ? 'update' : 'create', input.name,
        input.category_id, input.price, input.stock, input.picture, input.spec,
        input.description, input.id, merchantId])
      submissionId = input.id
      await connection.execute('DELETE FROM vueshop_goods_submission_album WHERE submission_id = ?', [submissionId])
    } else {
      if (input.goods_id) {
        const [goods] = await connection.execute<RowDataPacket[]>(
          'SELECT id FROM vueshop_goods WHERE id = ? AND merchant_id = ? LIMIT 1',
          [input.goods_id, merchantId]
        )
        if (!goods[0]) throw new AppError('商品不存在或不属于当前商家', 'GOODS_NOT_OWNED')
      }
      const [result] = await connection.execute<ResultSetHeader>(`
        INSERT INTO vueshop_goods_submission
          (goods_id, merchant_id, action, name, category_id, price, stock, picture, spec, description, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
      `, [input.goods_id ?? null, merchantId, input.goods_id ? 'update' : 'create', input.name,
        input.category_id, input.price, input.stock, input.picture, input.spec, input.description])
      submissionId = result.insertId
    }
    await insertSubmissionAlbum(connection, submissionId, input.album)
    await connection.commit()
    return submissionId
  } catch (error) {
    await connection.rollback()
    throw error
  } finally { connection.release() }
}

export async function submitGoods(merchantId: number, id: number): Promise<void> {
  const [result] = await db.execute<ResultSetHeader>(`
    UPDATE vueshop_goods_submission SET status = 'pending', submitted_at = NOW(),
      rejection_reason = '', reviewed_at = NULL, reviewed_by = NULL
    WHERE id = ? AND merchant_id = ? AND status IN ('draft', 'rejected')
  `, [id, merchantId])
  if (!result.affectedRows) throw new AppError('商品草稿不存在或当前状态不能提交', 'SUBMISSION_NOT_SUBMITTABLE')
}

export async function listGoods(merchantId: number): Promise<MerchantGoodsItem[]> {
  const [rows] = await db.execute<MerchantGoodsRow[]>(`
    SELECT id, merchant_id, category_id, name, price, picture, stock, sale_status,
      compliance_status, compliance_reason, spec, description
    FROM vueshop_goods WHERE merchant_id = ? ORDER BY id DESC
  `, [merchantId])
  return rows.map(row => ({ ...row, price: Number(row.price) }))
}

export async function updateStock(merchantId: number, goodsId: number, stock: number): Promise<void> {
  const [result] = await db.execute<ResultSetHeader>(
    'UPDATE vueshop_goods SET stock = ? WHERE id = ? AND merchant_id = ?',
    [stock, goodsId, merchantId]
  )
  if (!result.affectedRows) throw new AppError('商品不存在或不属于当前商家', 'GOODS_NOT_OWNED')
}

export async function updateSaleStatus(merchantId: number, goodsId: number, saleStatus: string): Promise<void> {
  if (saleStatus === 'on_sale') {
    const [rows] = await db.execute<(RowDataPacket & { compliance_status: string })[]>(
      'SELECT compliance_status FROM vueshop_goods WHERE id = ? AND merchant_id = ? LIMIT 1', [goodsId, merchantId]
    )
    if (rows[0]?.compliance_status === 'forced_off_sale') {
      throw new AppError('该商品已被平台强制下架，请整改后重新提交审核', 'GOODS_FORCED_OFF_SALE')
    }
  }
  const [result] = await db.execute<ResultSetHeader>(
    'UPDATE vueshop_goods SET sale_status = ? WHERE id = ? AND merchant_id = ?',
    [saleStatus, goodsId, merchantId]
  )
  if (!result.affectedRows) throw new AppError('商品不存在或不属于当前商家', 'GOODS_NOT_OWNED')
}

const dateText = (value: Date | string | null): string | null => value instanceof Date ? value.toISOString() : value

export async function listOrders(merchantId: number | null, status?: OrderStatus): Promise<MerchantOrder[]> {
  const values: Array<number | string | null> = [merchantId]
  const statusClause = status ? 'AND o.status = ?' : ''
  if (status) values.push(status)
  const [rows] = await db.execute<MerchantOrderRow[]>(`
    SELECT o.id, o.order_no, o.status, o.total_amount, o.receiver_name, o.receiver_phone,
      o.receiver_address, o.created_at, o.payment_expires_at, o.paid_at, o.shipped_at,
      o.completed_at, i.id AS item_id, i.goods_id, i.goods_name, i.goods_picture,
      i.goods_spec, i.unit_price, i.quantity, i.subtotal, i.merchant_id, i.merchant_name,
      i.fulfillment_status, i.shipping_carrier, i.tracking_no, i.shipped_at AS item_shipped_at
    FROM vueshop_order_item i INNER JOIN vueshop_order o ON o.id = i.order_id
    WHERE i.merchant_id <=> ? ${statusClause}
    ORDER BY o.id DESC, i.id`, values)
  const orders = new Map<number, MerchantOrder>()
  for (const row of rows) {
    let order = orders.get(row.id)
    if (!order) {
      const allowed: OrderStatus[] = ['pending', 'paid', 'cancelled', 'shipped', 'completed', 'refunded']
      const parsed = allowed.find(item => item === row.status)
      if (!parsed) throw new AppError('订单状态异常', 'INVALID_ORDER_STATUS')
      order = {
        id: row.id, order_no: row.order_no, status: parsed, total_amount: Number(row.total_amount),
        receiver_name: row.receiver_name, receiver_phone: row.receiver_phone,
        receiver_address: row.receiver_address, created_at: dateText(row.created_at)!,
        payment_expires_at: dateText(row.payment_expires_at), paid_at: dateText(row.paid_at),
        shipped_at: dateText(row.shipped_at), completed_at: dateText(row.completed_at), items: []
      }
      orders.set(row.id, order)
    }
    order.items.push({
      id: row.item_id, goods_id: row.goods_id, goods_name: row.goods_name,
      goods_picture: row.goods_picture, goods_spec: row.goods_spec, unit_price: Number(row.unit_price),
      quantity: row.quantity, subtotal: Number(row.subtotal), merchant_id: row.merchant_id,
      merchant_name: row.merchant_name, fulfillment_status: row.fulfillment_status === 'shipped' ? 'shipped' : 'pending',
      shipping_carrier: row.shipping_carrier, tracking_no: row.tracking_no,
      shipped_at: dateText(row.item_shipped_at)
    })
  }
  return [...orders.values()]
}

export async function shipOrder(merchantId: number | null, input: ShipMerchantOrderInput): Promise<void> {
  const connection = await db.getConnection()
  try {
    await connection.beginTransaction()
    const [orders] = await connection.execute<(RowDataPacket & { status: string })[]>(
      `SELECT o.status FROM vueshop_order o INNER JOIN vueshop_order_item i ON i.order_id = o.id
       WHERE o.id = ? AND i.merchant_id <=> ? LIMIT 1 FOR UPDATE`, [input.order_id, merchantId]
    )
    if (!orders[0]) throw new AppError('订单不存在或不属于当前店铺', 'ORDER_NOT_OWNED')
    if (orders[0].status !== 'paid') throw new AppError('只有已支付订单可以发货', 'ORDER_STATUS_INVALID')
    const [result] = await connection.execute<ResultSetHeader>(
      `UPDATE vueshop_order_item SET fulfillment_status = 'shipped', shipping_carrier = ?,
       tracking_no = ?, shipped_at = NOW() WHERE order_id = ? AND merchant_id <=> ?
       AND fulfillment_status = 'pending'`,
      [input.shipping_carrier, input.tracking_no, input.order_id, merchantId]
    )
    if (!result.affectedRows) throw new AppError('该店铺商品已经发货', 'ORDER_ALREADY_SHIPPED')
    const [pending] = await connection.execute<(RowDataPacket & { count: number })[]>(
      "SELECT COUNT(*) AS count FROM vueshop_order_item WHERE order_id = ? AND fulfillment_status <> 'shipped'", [input.order_id]
    )
    if (Number(pending[0]?.count ?? 0) === 0) {
      await connection.execute(
        "UPDATE vueshop_order SET status = 'shipped', shipped_at = NOW() WHERE id = ? AND status = 'paid'", [input.order_id]
      )
    }
    await connection.commit()
  } catch (error) { await connection.rollback(); throw error }
  finally { connection.release() }
}
