import type { RowDataPacket } from 'mysql2/promise'
import type { PublicUser, Category, Goods, GoodsListItem, AlbumImage } from '../../../shared/api'
export type UserRow = RowDataPacket & PublicUser & { status: number }
export type UserPasswordRow = UserRow & { password: string }
export type AdminRow = RowDataPacket & PublicUser
export type AdminPasswordRow = AdminRow & { password: string }
export type CategoryRow = RowDataPacket & Category
export type GoodsRow = RowDataPacket & Omit<Goods, 'price'> & { price: string }
export type GoodsListRow = GoodsRow & Pick<GoodsListItem, 'category_name' | 'parent_category_name'>
export type AlbumRow = RowDataPacket & AlbumImage
export type CountRow = RowDataPacket & { count: number; total: number }
