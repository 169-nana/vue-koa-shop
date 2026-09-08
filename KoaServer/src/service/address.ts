import type { AddressInput, UserAddress } from '../../../shared/api'
import type { ResultSetHeader } from 'mysql2/promise'
import type { AddressRow, CountRow } from '../db/types'

import db from '../db'
import { AppError } from '../utils/input'

const toAddress = (row: AddressRow): UserAddress => ({
  id: row.id,
  receiver_name: row.receiver_name,
  receiver_phone: row.receiver_phone,
  receiver_address: row.receiver_address,
  is_default: row.is_default === 1
})

export const findByUserId = async (userId: number): Promise<UserAddress[]> => {
  const [rows] = await db.execute<AddressRow[]>(
    `
      SELECT id, user_id, receiver_name, receiver_phone,
        receiver_address, is_default
      FROM vueshop_user_address
      WHERE user_id = ?
      ORDER BY is_default DESC, id DESC
    `,
    [userId]
  )
  return rows.map(toAddress)
}

export const findById = async (userId: number, id: number): Promise<UserAddress | null> => {
  const [rows] = await db.execute<AddressRow[]>(
    `
      SELECT id, user_id, receiver_name, receiver_phone,
        receiver_address, is_default
      FROM vueshop_user_address
      WHERE id = ? AND user_id = ?
      LIMIT 1
    `,
    [id, userId]
  )
  return rows[0] ? toAddress(rows[0]) : null
}

export const create = async (userId: number, input: AddressInput): Promise<number> => {
  const connection = await db.getConnection()
  try {
    await connection.beginTransaction()
    await connection.execute('SELECT id FROM vueshop_user WHERE id = ? FOR UPDATE', [userId])
    const [counts] = await connection.execute<CountRow[]>(
      'SELECT COUNT(*) AS total FROM vueshop_user_address WHERE user_id = ?',
      [userId]
    )
    const isDefault = input.is_default || Number(counts[0]?.total ?? 0) === 0
    if (isDefault) {
      await connection.execute(
        'UPDATE vueshop_user_address SET is_default = 0 WHERE user_id = ?',
        [userId]
      )
    }
    const [result] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO vueshop_user_address (
          user_id, receiver_name, receiver_phone,
          receiver_address, is_default
        ) VALUES (?, ?, ?, ?, ?)
      `,
      [userId, input.receiver_name, input.receiver_phone, input.receiver_address, isDefault ? 1 : 0]
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

export const update = async (
  userId: number,
  id: number,
  input: AddressInput
): Promise<void> => {
  const connection = await db.getConnection()
  try {
    await connection.beginTransaction()
    await connection.execute('SELECT id FROM vueshop_user WHERE id = ? FOR UPDATE', [userId])
    if (input.is_default) {
      await connection.execute(
        'UPDATE vueshop_user_address SET is_default = 0 WHERE user_id = ?',
        [userId]
      )
    }
    const [result] = await connection.execute<ResultSetHeader>(
      `
        UPDATE vueshop_user_address
        SET receiver_name = ?, receiver_phone = ?, receiver_address = ?,
          is_default = CASE WHEN ? = 1 THEN 1 ELSE is_default END
        WHERE id = ? AND user_id = ?
      `,
      [input.receiver_name, input.receiver_phone, input.receiver_address, input.is_default ? 1 : 0, id, userId]
    )
    if (result.affectedRows === 0) throw new AppError('收货地址不存在', 'ADDRESS_NOT_FOUND')
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export const setDefault = async (userId: number, id: number): Promise<void> => {
  const connection = await db.getConnection()
  try {
    await connection.beginTransaction()
    await connection.execute('SELECT id FROM vueshop_user WHERE id = ? FOR UPDATE', [userId])
    await connection.execute(
      'UPDATE vueshop_user_address SET is_default = 0 WHERE user_id = ?',
      [userId]
    )
    await connection.execute(
      'UPDATE vueshop_user_address SET is_default = 1 WHERE id = ? AND user_id = ?',
      [id, userId]
    )
    const [rows] = await connection.execute<AddressRow[]>(
      `SELECT id, user_id, receiver_name, receiver_phone, receiver_address, is_default
       FROM vueshop_user_address WHERE id = ? AND user_id = ? LIMIT 1`,
      [id, userId]
    )
    if (!rows[0]) throw new AppError('收货地址不存在', 'ADDRESS_NOT_FOUND')
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export const remove = async (userId: number, id: number): Promise<void> => {
  const connection = await db.getConnection()
  try {
    await connection.beginTransaction()
    await connection.execute('SELECT id FROM vueshop_user WHERE id = ? FOR UPDATE', [userId])
    const [rows] = await connection.execute<AddressRow[]>(
      `SELECT id, user_id, receiver_name, receiver_phone, receiver_address, is_default
       FROM vueshop_user_address WHERE id = ? AND user_id = ? LIMIT 1 FOR UPDATE`,
      [id, userId]
    )
    const address = rows[0]
    if (!address) throw new AppError('收货地址不存在', 'ADDRESS_NOT_FOUND')
    await connection.execute('DELETE FROM vueshop_user_address WHERE id = ? AND user_id = ?', [id, userId])
    if (address.is_default === 1) {
      await connection.execute(
        `UPDATE vueshop_user_address SET is_default = 1
         WHERE user_id = ? ORDER BY id DESC LIMIT 1`,
        [userId]
      )
    }
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}
