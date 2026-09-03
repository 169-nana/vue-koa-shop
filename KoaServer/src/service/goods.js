const db = require('../db')

// 只能在当前文件内部使用,抽取相册插入的逻辑，以便在新增商品和更新商品时复用
async function insertAlbum(
  connection,
  goodsId,
  album
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

const buildFilters = ({ keyword = '', categoryId = null, minPrice = null, maxPrice = null, minStock = null, maxStock = null } = {}) => {
  const clauses = []
  const values = []
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
exports.findPage = async ({ offset, pagesize, ...filters }) => {
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

  const [rows] = await db.execute(sql, [
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
exports.countAll = async (filters = {}) => {
  const { where, values } = buildFilters(filters)
  const sql = `
    SELECT COUNT(*) AS total
    FROM vueshop_goods AS g
    LEFT JOIN vueshop_category AS c ON c.id = g.category_id
    ${where}
  `

  const [rows] = await db.execute(sql, values)

  return Number(rows[0].total)
}

// 根据ID查询商品
exports.findById = async id => {
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

  const [rows] = await db.execute(sql, [id])
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
exports.findAlbumByGoodsId = async goodsId => {
  const sql = `
    SELECT id, goods_id, picture
    FROM vueshop_goods_album
    WHERE goods_id = ?
    ORDER BY id ASC
  `

  const [rows] = await db.execute(sql, [
    goodsId
  ])

  return rows
}

// 新增商品及相册事务处理
exports.createWithAlbum = async (
  goods,
  album
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
      await connection.execute(goodsSql, [
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
exports.updateWithAlbum = async (
  goods,
  album
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
      await connection.execute(goodsSql, [
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
      const error = new Error('商品不存在')
      error.code = 'GOODS_NOT_FOUND'
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
exports.removeWithAlbum = async id => {
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
      await connection.execute(
        `
          DELETE FROM vueshop_goods
          WHERE id = ?
        `,
        [id]
      )

    if (result.affectedRows === 0) {
      const error = new Error('商品不存在')
      error.code = 'GOODS_NOT_FOUND'
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
