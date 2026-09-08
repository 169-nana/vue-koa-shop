import type { RowDataPacket } from 'mysql2/promise'
import type {
  PublicUser,
  PublicAdmin,
  Category,
  Goods,
  GoodsListItem,
  AlbumImage,
  CartItem,
  OrderItem,
  UserAddress,
  RefundApplication,
  ReviewableItem,
  GoodsReview
} from '../../../shared/api'

/**
 * MySQL 返回的购物车查询结果。
 *
 * 数据库中的 DECIMAL 会被 mysql2 返回为字符串，
 * 所以这里把 API 的 number 价格替换成 string。
 */
export type CartItemRow =
  RowDataPacket &
  Omit<CartItem, 'price'> & {
    price: string
  }

/**
 * 加入购物车时查询到的商品库存和已有数量。
 */
export type CartStockRow =
  RowDataPacket & {
    stock: number
    cart_quantity: number
    spec: string
  }

/**
 * 修改购物车数量时查询到的数据。
 */
export type CartUpdateRow =
  RowDataPacket & {
    id: number
    goods_id: number
    stock: number
  }

export type OrderCheckoutRow =
  RowDataPacket & {
    cart_id: number | null
    goods_id: number
    goods_name: string
    goods_picture: string
    goods_spec: string
    available_spec: string
    unit_price: string
    quantity: number
    stock: number
  }

export type AddressRow = RowDataPacket & Omit<UserAddress, 'is_default'> & {
  user_id: number
  is_default: 0 | 1
}

export type AddressIdRow = RowDataPacket & { id: number }

export type DashboardRow = RowDataPacket & {
  cart_count: number | string
  pending_order_count: number | string
  after_sale_count: number | string
  reviewable_count: number | string
}

export type RefundRow = RowDataPacket &
  Omit<RefundApplication, 'refund_amount' | 'status' | 'created_at'> & {
    user_id: number
    refund_amount: string
    status: string
    created_at: Date | string
  }

export type ReviewableRow = RowDataPacket &
  Omit<ReviewableItem, 'created_at'> & {
    created_at: Date | string
  }

export type GoodsReviewRow = RowDataPacket &
  Omit<GoodsReview, 'created_at'> & {
    created_at: Date | string
  }

export type OrderRow =
  RowDataPacket & {
    id: number
    order_no: string
    user_id: number
    status: string
    total_amount: string
    receiver_name: string
    receiver_phone: string
    receiver_address: string
    created_at: Date | string
  }

export type OrderItemRow =
  RowDataPacket &
  Omit<OrderItem, 'unit_price' | 'subtotal'> & {
    order_id: number
    unit_price: string
    subtotal: string
  }

export type UserRow = RowDataPacket & PublicUser & { status: number }

export type UserPasswordRow = UserRow & { password: string }

export type AdminRow = RowDataPacket & PublicAdmin

export type AdminPasswordRow = AdminRow & { password: string }

export type CategoryRow = RowDataPacket & Category

export type GoodsRow = RowDataPacket & Omit<Goods, 'price'> & { price: string }

export type GoodsListRow = GoodsRow & Pick<GoodsListItem, 'category_name' | 'parent_category_name'>

export type AlbumRow = RowDataPacket & AlbumImage

export type CountRow = RowDataPacket & { count: number; total: number }
