import type {
  RowDataPacket
} from 'mysql2/promise'

import type {
  Goods
} from '../../../shared/api'

import db from '../db'

export interface AgentGoodsSearchInput {
  keyword?: string
  categoryId?: number
  minPrice?: number
  maxPrice?: number
  limit: number
}

type AgentGoodsRow =
  RowDataPacket &
  Omit<Goods, 'price'> & {
    price: string
  }

type CategorySignalRow = RowDataPacket & {
  category_id: number
  score: number | string
}

export async function searchPublicGoods(
  input: AgentGoodsSearchInput
): Promise<Goods[]> {
  const clauses = [
    "g.sale_status = 'on_sale'",
    "g.compliance_status = 'normal'",
    `(
      g.merchant_id IS NULL OR
      m.status = 'approved'
    )`
  ]

  const values: Array<string | number> = []

  if (input.keyword) {
    clauses.push(`
      (
        g.name LIKE ? OR
        g.spec LIKE ? OR
        g.description LIKE ?
      )
    `)

    const keyword = `%${input.keyword}%`

    values.push(
      keyword,
      keyword,
      keyword
    )
  }

  if (input.categoryId !== undefined) {
    clauses.push(`
      (
        g.category_id = ? OR
        c.pid = ?
      )
    `)

    values.push(
      input.categoryId,
      input.categoryId
    )
  }

  if (input.minPrice !== undefined) {
    clauses.push('g.price >= ?')
    values.push(input.minPrice)
  }

  if (input.maxPrice !== undefined) {
    clauses.push('g.price <= ?')
    values.push(input.maxPrice)
  }

  values.push(input.limit)

  const [rows] =
    await db.execute<AgentGoodsRow[]>(
      `
        SELECT
          g.id,
          g.category_id,
          g.name,
          g.price,
          g.picture,
          g.stock,
          g.spec,
          g.description
        FROM vueshop_goods AS g
        LEFT JOIN vueshop_category AS c
          ON c.id = g.category_id
        LEFT JOIN vueshop_merchant AS m
          ON m.id = g.merchant_id
        WHERE ${clauses.join(' AND ')}
        ORDER BY
          (g.stock > 0) DESC,
          g.id DESC
        LIMIT ?
      `,
      values
    )

  return rows.map(row => ({
    ...row,
    price: Number(row.price)
  }))
}

export async function findPersonalizedGoods(
  userId: number,
  limit: number
): Promise<{ products: Goods[]; personalized: boolean }> {
  const [signals] = await db.execute<CategorySignalRow[]>(
    `
      SELECT category_id, COUNT(*) AS score
      FROM (
        SELECT g.category_id
        FROM vueshop_cart AS c
        INNER JOIN vueshop_goods AS g ON g.id = c.goods_id
        WHERE c.user_id = ?
        UNION ALL
        SELECT g.category_id
        FROM vueshop_order AS o
        INNER JOIN vueshop_order_item AS oi ON oi.order_id = o.id
        INNER JOIN vueshop_goods AS g ON g.id = oi.goods_id
        WHERE o.user_id = ?
      ) AS user_signals
      GROUP BY category_id
      ORDER BY score DESC, category_id ASC
      LIMIT 1
    `,
    [userId, userId]
  )

  const categoryId = signals[0]?.category_id
  const products = await searchPublicGoods({
    ...(categoryId ? { categoryId } : {}),
    limit
  })
  return { products, personalized: categoryId !== undefined }
}
