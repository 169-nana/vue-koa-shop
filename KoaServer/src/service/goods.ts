import type { GoodsListItem, Goods, AlbumImage } from '../../../shared/api'
import type { ResultSetHeader, PoolConnection } from 'mysql2/promise'
import type { GoodsRow, GoodsListRow, AlbumRow, CountRow } from '../db/types'
import type { GoodsInput, IdInput } from '../../../shared/api'
import type {GoodsFilters,PublicGoodsFilters} from '../types'

import { AppError } from '../utils/input'
import db from '../db'

// 只能在当前文件内部使用,抽取相册插入的逻辑，以便在新增商品和更新商品时复用
async function insertAlbum(
  connection: PoolConnection,
  goodsId: number,
  album: string[]
) {
  if (album.length === 0) {
    return
  }

  //生成sql语句中的占位符
  const placeholders = album
    .map(() => '(?, ?)')
    .join(', ')

  //占位符对应的参数
  const values = album.flatMap(picture => [
    goodsId,
    picture
  ])

  const sql = `
    INSERT INTO vueshop_goods_album
      (goods_id, picture)
    VALUES ${placeholders}
  `

  await connection.execute(sql, values)
}

// 构建商品查询条件
const buildFilters = ({ keyword = '', categoryId = null, minPrice = null, maxPrice = null, minStock = null, maxStock = null }: GoodsFilters = {}) => {
  const clauses = []
  const values: (string | number)[] = []
  if (keyword) {
    clauses.push('(g.name LIKE ? OR g.spec LIKE ? OR CAST(g.id AS CHAR) = ?)')
    const likeKeyword = `%${keyword}%`
    values.push(likeKeyword, likeKeyword, keyword)
  }
  if (categoryId !== null) {
    clauses.push('(g.category_id = ? OR c.pid = ?)')
    values.push(categoryId, categoryId)
  }
  if (minPrice !== null) { clauses.push('g.price >= ?'); values.push(minPrice) }
  if (maxPrice !== null) { clauses.push('g.price <= ?'); values.push(maxPrice) }
  if (minStock !== null) { clauses.push('g.stock >= ?'); values.push(minStock) }
  if (maxStock !== null) { clauses.push('g.stock <= ?'); values.push(maxStock) }
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', values }
}

// 分页查询商品
export const findPage = async ({ offset, pagesize, ...filters }: GoodsFilters & { offset: number; pagesize: number }): Promise<GoodsListItem[]> => {
  const { where, values } = buildFilters(filters)
  const sql = `
    SELECT
      g.id,
      g.category_id,
      g.name,
      g.price,
      g.picture,
      g.stock,
      g.spec,
      g.description,
      c.name AS category_name,
      p.name AS parent_category_name
    FROM vueshop_goods AS g
    LEFT JOIN vueshop_category AS c ON c.id = g.category_id
    LEFT JOIN vueshop_category AS p ON p.id = c.pid
    ${where}
    ORDER BY g.id DESC
    LIMIT ? OFFSET ?
  `

  const [rows] = await db.execute<GoodsListRow[]>(sql, [
    ...values,
    pagesize,
    offset
  ])

  return rows.map(item => ({
    ...item,

    // MySQL的DECIMAL通常被mysql2返回为字符串
    price: Number(item.price)
  }))
}

// 统计商品总数
export const countAll = async (filters: GoodsFilters = {}) => {
  const { where, values } = buildFilters(filters)
  const sql = `
    SELECT COUNT(*) AS total
    FROM vueshop_goods AS g
    LEFT JOIN vueshop_category AS c ON c.id = g.category_id
    ${where}
  `

  const [rows] = await db.execute<CountRow[]>(sql, values)

  return Number(rows[0].total)
}

// 根据ID查询商品
export const findById = async (id: number): Promise<Goods | null> => {
  const sql = `
    SELECT
      id,
      category_id,
      name,
      price,
      picture,
      stock,
      spec,
      description
    FROM vueshop_goods
    WHERE id = ?
    LIMIT 1
  `

  const [rows] = await db.execute<GoodsRow[]>(sql, [id])
  const goods = rows[0]

  if (!goods) {
    return null
  }

  return {
    ...goods,
    price: Number(goods.price)
  }
}

// 查询商品相册
export const findAlbumByGoodsId = async (goodsId: number): Promise<AlbumImage[]> => {
  const sql = `
    SELECT id, goods_id, picture
    FROM vueshop_goods_album
    WHERE goods_id = ?
    ORDER BY id ASC
  `

  const [rows] = await db.execute<AlbumRow[]>(sql, [
    goodsId
  ])

  return rows
}

// 查询前台公开商品列表，使用商品 ID 作为分页游标
export const findPublicPage = async ({
  lastId,
  pagesize,
  categoryId
}: PublicGoodsFilters): Promise<Goods[]> => {
  const clauses: string[] = []
  const values: number[] = []

  /*
   * 第一次请求 lastId 为 0，不添加 ID 条件。
   * 后续请求只查询比上一页最后一个 ID 更小的数据。
   */
  if (lastId > 0) {
    clauses.push('g.id < ?')
    values.push(lastId)
  }

  /*
   * categoryId 为 0 表示查询全部分类。
   *
   * g.category_id = ?：
   *   传入二级分类时，查询该分类商品。
   *
   * c.pid = ?：
   *   传入一级分类时，查询它下面二级分类的商品。
   */
  if (categoryId > 0) {
    clauses.push(
      '(g.category_id = ? OR c.pid = ?)'
    )
    values.push(categoryId, categoryId)
  }

  const where = clauses.length > 0
    ? `WHERE ${clauses.join(' AND ')}`
    : ''

  const sql = `
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
    ${where}
    ORDER BY g.id DESC
    LIMIT ?
  `

  /*
   * 前端需要 10 条时查询 11 条。
   * 多出来的一条用于判断是否还有下一页。
   */
  values.push(pagesize + 1)

  const [rows] =
    await db.execute<GoodsRow[]>(sql, values)

  return rows.map(goods => ({
    ...goods,

    /*
     * MySQL DECIMAL 会被 mysql2 读取成字符串，
     * API 层继续遵守项目现有规则，转换成 number。
     */
    price: Number(goods.price)
  }))
}

// 新增商品及相册事务处理
export const createWithAlbum = async (
  goods: Omit<GoodsInput, 'album' | 'price'> & { price: string },
  album: string[]
) => {
  // 从连接池中取出一个固定连接
  const connection = await db.getConnection()

  //如果出现错误，就回滚事务
  try {
    // 开始事务
    await connection.beginTransaction()

    const goodsSql = `
      INSERT INTO vueshop_goods (
        category_id,
        name,
        price,
        picture,
        stock,
        spec,
        description
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `

    const [goodsResult] =
      await connection.execute<ResultSetHeader>(goodsSql, [
        goods.category_id,
        goods.name,
        goods.price,
        goods.picture,
        goods.stock,
        goods.spec,
        goods.description
      ])

    const goodsId = goodsResult.insertId

    // 存在相册图片时批量插入
    await insertAlbum(
      connection,
      goodsId,
      album
    )

    // 两张表都操作成功，提交事务
    await connection.commit()

    return goodsId
  } catch (error) {
    // 任意一步失败，撤销前面的操作
    await connection.rollback()

    // 将原始错误继续抛给全局错误中间件
    throw error
  } finally {
    // 无论成功还是失败，都归还连接
    connection.release()
  }
}

//商品修改事务处理
export const updateWithAlbum = async (
  goods: Omit<GoodsInput, 'album' | 'price'> & { price: string } & IdInput,
  album: string[]
) => {
  const connection = await db.getConnection()

  try {
    await connection.beginTransaction()

    const goodsSql = `
      UPDATE vueshop_goods
      SET
        category_id = ?,
        name = ?,
        price = ?,
        picture = ?,
        stock = ?,
        spec = ?,
        description = ?
      WHERE id = ?
    `

    const [result] =
      await connection.execute<ResultSetHeader>(goodsSql, [
        goods.category_id,
        goods.name,
        goods.price,
        goods.picture,
        goods.stock,
        goods.spec,
        goods.description,
        goods.id
      ])

    if (result.affectedRows === 0) {
      const error = new AppError('商品不存在', 'GOODS_NOT_FOUND')
      throw error
    }

    // 无论新相册是否为空，都先删除旧记录
    await connection.execute(
      `
        DELETE FROM vueshop_goods_album
        WHERE goods_id = ?
      `,
      [goods.id]
    )

    await insertAlbum(
      connection,
      goods.id,
      album
    )

    await connection.commit()

    return result.affectedRows
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

//商品删除事务处理
export const removeWithAlbum = async (id: number) => {
  const connection = await db.getConnection()

  try {
    await connection.beginTransaction()

    // 先删除子表记录
    await connection.execute(
      `
        DELETE FROM vueshop_goods_album
        WHERE goods_id = ?
      `,
      [id]
    )

    // 再删除商品
    const [result] =
      await connection.execute<ResultSetHeader>(
        `
          DELETE FROM vueshop_goods
          WHERE id = ?
        `,
        [id]
      )

    if (result.affectedRows === 0) {
      const error = new AppError('商品不存在', 'GOODS_NOT_FOUND')
      throw error
    }

    await connection.commit()

    return result.affectedRows
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}
