//存放客户端列表数据查询的操作

const db = require('../db')

// 查询所有分类
exports.findAll = async () => {
  //虽然前端会转换树形结构，但数据库查询最好仍然返回稳定顺序。否则同一批数据在不同查询中可能顺序不一致。
  //明确列出查询字段，好处是：1.避免查询不必要的字段，2.避免数据库表结构变更导致查询结果不一致
  const sql = `
    SELECT id, name, picture, pid
    FROM vueshop_category
    ORDER BY pid ASC, id ASC
  `

  const [rows] = await db.execute(sql)

  return rows
}

// 根据ID查询分类
exports.findById = async id => {
  const sql = `
    SELECT id, name, picture, pid
    FROM vueshop_category
    WHERE id = ?
    LIMIT 1
  `

  const [rows] = await db.execute(sql, [id])

  return rows[0] || null
}

// 查询指定的一级分类,pid=0表示一级分类
exports.findRootById = async id => {
  const sql = `
    SELECT id, name, picture, pid
    FROM vueshop_category
    WHERE id = ? AND pid = 0
    LIMIT 1
  `

  const [rows] = await db.execute(sql, [id])

  return rows[0] || null
}

// 新增分类
exports.create = async category => {
  const sql = `
    INSERT INTO vueshop_category
      (name, picture, pid)
    VALUES
      (?, ?, ?)
  `

  const [result] = await db.execute(sql, [
    category.name,
    category.picture,
    category.pid
  ])

  return result.insertId
}

// 查询某分类拥有多少个子分类
exports.countChildren = async id => {
  const sql = `
    SELECT COUNT(*) AS count
    FROM vueshop_category
    WHERE pid = ?
  `

  const [rows] = await db.execute(sql, [id])

  return Number(rows[0].count)
}

// 查询某分类被多少个商品引用
exports.countGoods = async id => {
  const sql = `
    SELECT COUNT(*) AS count
    FROM vueshop_goods
    WHERE category_id = ?
  `

  const [rows] = await db.execute(sql, [id])

  return Number(rows[0].count)
}

// 修改分类
exports.update = async category => {
  const sql = `
    UPDATE vueshop_category
    SET name = ?, picture = ?, pid = ?
    WHERE id = ?
  `

  const [result] = await db.execute(sql, [
    category.name,
    category.picture,
    category.pid,
    category.id
  ])

  return result.affectedRows
}

// 删除分类
exports.removeById = async id => {
  const sql = `
    DELETE FROM vueshop_category
    WHERE id = ?
  `

  const [result] = await db.execute(sql, [id])

  return result.affectedRows
}