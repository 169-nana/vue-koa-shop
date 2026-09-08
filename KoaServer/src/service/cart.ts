//新建购物车的数据库操作
import type { CartItem } from '../../../shared/api'
import type {
  CartItemRow,
  CartStockRow,
  CartUpdateRow,
  AddressIdRow
} from '../db/types'
import type { ResultSetHeader } from 'mysql2/promise'

import db from '../db'
import { AppError } from '../utils/input'
import { parseGoodsSpecs } from '../../../shared/goods'
/**
 * 查询指定用户的购物车。
 */
export const findByUserId = async (
  userId: number
): Promise<CartItem[]> => {
  const sql = `
    SELECT
      c.id,
      c.goods_id,
      c.quantity,
      c.selected_spec,
      c.address_id,
      g.name,
      g.picture,
      g.spec,
      g.price,
      g.stock
    FROM vueshop_cart AS c
    INNER JOIN vueshop_goods AS g
      ON g.id = c.goods_id
    WHERE c.user_id = ?
    ORDER BY c.id DESC
  `

  const [rows] =
    await db.execute<CartItemRow[]>(
      sql,
      [userId]
    )

  return rows.map(item => ({
    ...item,

    // MySQL DECIMAL 字段需要转换成 API 使用的 number。
    price: Number(item.price)
  }))
}

/**
 * 将商品加入指定用户的购物车。
 */
export const add = async (
  userId: number,
  goodsId: number,
  quantity: number,
  selectedSpec: string,
  addressId: number
): Promise<void> => {
  const connection =
    await db.getConnection()

  try {
    await connection.beginTransaction()

    /*
     * FOR UPDATE锁定商品行，加上排它锁，避免两个请求同时读取到相同库存。
     */
    const [rows] =
      await connection.execute<
        CartStockRow[]
      >(
        `
          SELECT
            g.stock,
            g.spec,
            COALESCE(c.quantity, 0)
              AS cart_quantity
          FROM vueshop_goods AS g
          LEFT JOIN vueshop_cart AS c
            ON c.goods_id = g.id
            AND c.user_id = ?
            AND c.selected_spec = ?
          WHERE g.id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [userId, selectedSpec, goodsId]
      )

    const goods = rows[0]

    if (!goods) {
      throw new AppError(
        '商品不存在',
        'GOODS_NOT_FOUND'
      )
    }


    if (!parseGoodsSpecs(goods.spec).includes(selectedSpec)) {
      throw new AppError('请选择有效的商品规格', 'INVALID_GOODS_SPEC')
    }

    const [addresses] = await connection.execute<AddressIdRow[]>(
      'SELECT id FROM vueshop_user_address WHERE id = ? AND user_id = ? LIMIT 1',
      [addressId, userId]
    )
    if (!addresses[0]) {
      throw new AppError('请选择有效的收货地址', 'ADDRESS_NOT_FOUND')
    }

    const nextQuantity =
      goods.cart_quantity + quantity

    if (nextQuantity > goods.stock) {
      throw new AppError(
        `库存不足，当前最多可购买${goods.stock}件`,
        'INSUFFICIENT_STOCK'
      )
    }

    /*
     * 第一次加入时插入记录；
     * 已经加入过时，在原数量上累加。
     */
    await connection.execute(
      `
        INSERT INTO vueshop_cart (
          user_id,
          goods_id,
          quantity,
          selected_spec,
          address_id
        )
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          quantity = quantity + ?,
          address_id = ?
      `,
      [
        userId,
        goodsId,
        quantity,
        selectedSpec,
        addressId,
        quantity,
        addressId
      ]
    )

    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

/**
 * 修改指定购物车商品的数量。
 */
export const updateQuantity = async (
  userId: number,
  cartId: number,
  quantity: number
): Promise<void> => {
  const connection =
    await db.getConnection()

  try {
    await connection.beginTransaction()

    /*
     * 同时检查购物车归属和最新商品库存。
     */
    const [rows] =
      await connection.execute<
        CartUpdateRow[]
      >(
        `
          SELECT
            c.id,
            c.goods_id,
            g.stock
          FROM vueshop_cart AS c
          INNER JOIN vueshop_goods AS g
            ON g.id = c.goods_id
          WHERE c.id = ?
            AND c.user_id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [cartId, userId]
      )

    const cartItem = rows[0]

    if (!cartItem) {
      throw new AppError(
        '购物车商品不存在',
        'CART_ITEM_NOT_FOUND'
      )
    }

    if (quantity > cartItem.stock) {
      throw new AppError(
        `库存不足，当前最多可购买${cartItem.stock}件`,
        'INSUFFICIENT_STOCK'
      )
    }

    await connection.execute(
      `
        UPDATE vueshop_cart
        SET quantity = ?
        WHERE id = ?
          AND user_id = ?
      `,
      [
        quantity,
        cartId,
        userId
      ]
    )

    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

/** 删除当前用户的一条购物车记录。 */
export const remove = async (
  userId: number,
  cartId: number
): Promise<void> => {
  const [result] =
    await db.execute<ResultSetHeader>(
      `
        DELETE FROM vueshop_cart
        WHERE id = ?
          AND user_id = ?
      `,
      [cartId, userId]
    )

  if (result.affectedRows === 0) {
    throw new AppError(
      '购物车商品不存在',
      'CART_ITEM_NOT_FOUND'
    )
  }
}
