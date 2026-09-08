// 前后端共用的接口契约；这里只放类型，不引入数据库或浏览器代码。
export type ApiResponse<T> =
  | { errno: 0; data: T; errmsg: string }
  | { errno: 1 | 2; data: null; errmsg: string }
export interface Credentials { username: string; password: string }
export interface ChangeAdminPasswordInput { currentPassword: string; password: string }
export interface LoginResult { token: string }
export interface PublicUser { id: number; username: string; avatar: string }
export type PublicAdmin = PublicUser
export interface RegisterResult { id: number; username: string }
export interface IdInput { id: number }
export interface InsertResult { insertId: number }
export interface CategoryInput { name: string; pid: number; picture: string }
export interface Category extends CategoryInput { id: number }
export interface CategoryNode extends Category { children: CategoryNode[] }
export interface GoodsInput {
  name: string; category_id: number; price: number; stock: number;
  picture: string; album: string[]; spec: string; description: string
}
export interface Goods extends Omit<GoodsInput, 'album'> { id: number }
export interface GoodsListItem extends Goods { category_name: string | null; parent_category_name: string | null }
export interface AlbumImage { id: number; goods_id: number; picture: string }
export interface GoodsDetail extends Goods { album: AlbumImage[] }
export interface GoodsQuery {
  page?: number; pagesize?: number; keyword?: string; category_id?: number;
  min_price?: number; max_price?: number; min_stock?: number; max_stock?: number
}
export interface PageResult<T> { list: T[]; total: number }

/**
 * 前台商品列表的查询参数。
 *
 * 这里描述的是前端调用接口时允许传入的参数，
 * 所以使用接口中的 snake_case 命名。
 */
export interface PublicGoodsQuery {
  last_id?: number
  pagesize?: number
  category_id?: number
}

/**
 * 游标分页结果。
 *
 * T 是泛型，调用者可以决定 list 中放什么类型。
 * 例如 CursorPageResult<Goods> 表示商品分页结果。
 */
export interface CursorPageResult<T> {
  list: T[]
  hasMore: boolean
  nextLastId: number
}
export interface UploadResult { savepath: string; url?: string }

/**
 * 后端返回给前台的购物车商品。
 */
export interface CartItem {
  id: number
  goods_id: number
  name: string
  picture: string
  spec: string
  price: number
  stock: number
  quantity: number
  selected_spec: string
  address_id: number | null
}

/**
 * 加入购物车时前端提交的数据。
 */
export interface AddCartInput {
  goods_id: number
  quantity: number
  selected_spec: string
  address_id: number
}

/**
 * 修改购物车数量时前端提交的数据。
 */
export interface UpdateCartInput {
  id: number
  quantity: number
}

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'cancelled'
  | 'shipped'
  | 'completed'

export interface CreateOrderInput {
  cart_item_ids?: number[]
  direct_item?: DirectOrderItem
  address_id: number
}

export interface DirectOrderItem {
  goods_id: number
  quantity: number
  selected_spec: string
}

export interface AddressInput {
  receiver_name: string
  receiver_phone: string
  receiver_address: string
  is_default: boolean
}

export interface UpdateAddressInput extends AddressInput {
  id: number
}

export interface UserAddress extends AddressInput {
  id: number
}

export interface CreateOrderResult {
  id: number
  order_no: string
}

export interface OrderItem {
  id: number
  goods_id: number
  goods_name: string
  goods_picture: string
  goods_spec: string
  unit_price: number
  quantity: number
  subtotal: number
}

export interface OrderSummary {
  id: number
  order_no: string
  status: OrderStatus
  total_amount: number
  receiver_name: string
  created_at: string
}

export interface OrderDetail extends OrderSummary {
  receiver_phone: string
  receiver_address: string
  items: OrderItem[]
}

export interface UserDashboard {
  cart_count: number
  pending_order_count: number
  after_sale_count: number
  reviewable_count: number
}

export type RefundStatus = 'pending' | 'approved' | 'rejected'

export interface CreateRefundInput {
  order_id: number
  reason: string
}

export interface RefundApplication {
  id: number
  order_id: number
  order_no: string
  refund_amount: number
  reason: string
  status: RefundStatus
  created_at: string
}

export interface ReviewableItem {
  order_item_id: number
  order_id: number
  goods_id: number
  goods_name: string
  goods_picture: string
  goods_spec: string
  created_at: string
}

export interface CreateReviewInput {
  order_item_id: number
  rating: number
  content: string
}

export interface GoodsReview {
  id: number
  username: string
  avatar: string
  rating: number
  content: string
  created_at: string
}
