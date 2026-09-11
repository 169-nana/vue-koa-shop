// 前后端共用的接口契约；这里只放类型，不引入数据库或浏览器代码。
export type ApiResponse<T> =
  | { errno: 0; data: T; errmsg: string }
  | { errno: 1 | 2; data: null; errmsg: string }
export interface Credentials { username: string; password: string }
export interface ChangeAdminPasswordInput { currentPassword: string; password: string }
export interface LoginResult { token: string }
export interface PublicUser { id: number; username: string; avatar: string }
export type AdminRole = 'admin' | 'reviewer'
export interface PublicAdmin extends PublicUser { role: AdminRole; status: 0 | 1 }
export interface AdminAccount extends PublicAdmin { created_at: string | null }
export interface CreateAdminAccountInput { username: string; password: string; role: AdminRole }
export interface UpdateAdminAccountInput { id: number; role: AdminRole; status: 0 | 1 }
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
export interface PublicGoodsDetail extends Goods { merchant_name: string | null }
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

//定义前后端共享的 Agent 接口契约
//因为是前后端共享契约，此处不允许前端发送身份类型为system实现越权。允许assistant是为了实现短期记忆
export type ShopAgentMessageRole =
  | 'user'
  | 'assistant'

  //规定与agent助手交互的消息格式
export interface ShopAgentMessage {
  role: ShopAgentMessageRole
  content: string
}

export interface ShopAgentChatInput {
  messages: ShopAgentMessage[]
}

export interface ShopAgentReply {
  message: string
  products: Goods[]
  pending_action?: ShopAgentPendingAction
}

export interface ShopAgentPendingAction {
  type: 'add_to_cart'
  token: string
  title: string
  description: string
  expires_at: string
}

export interface ShopAgentActionInput {
  token: string
}

export interface ShopAgentActionResult {
  message: string
  cart_path: '/cart'
}

export type ShopAgentStreamEvent =
  | { type: 'delta'; content: string }
  | { type: 'reset' }
  | { type: 'products'; products: Goods[] }
  | { type: 'action'; action: ShopAgentPendingAction }
  | { type: 'done' }
  | { type: 'error'; message: string }

//
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

export type MerchantStatus = 'pending' | 'approved' | 'rejected' | 'suspended' | 'revoked'
export type GoodsSubmissionStatus = 'draft' | 'pending' | 'approved' | 'rejected'
export type GoodsSubmissionAction = 'create' | 'update'
export type GoodsSaleStatus = 'on_sale' | 'off_sale'
export type GoodsComplianceStatus = 'normal' | 'forced_off_sale'
export type ReviewDecision = 'approved' | 'rejected'
export type ReviewScene = 'merchant_application' | 'goods_submission'
export type EnforcementScene = 'goods_enforcement' | 'merchant_enforcement'
export type ReasonScene = ReviewScene | EnforcementScene
export type EnforcementAction = 'force_off_sale' | 'suspend' | 'revoke' | 'restore'

export interface MerchantApplicationInput {
  shop_name: string
  contact_name: string
  contact_phone: string
  description: string
  qualification_picture: string
}

export interface MerchantApplicationSubmitInput extends MerchantApplicationInput {
  id?: number
}

export interface MerchantApplication extends MerchantApplicationInput {
  id: number
  user_id: number
  username: string
  status: MerchantStatus
  rejection_reason: string
  enforcement_reason: string
  enforced_at: string | null
  enforcer_name: string | null
  submitted_at: string
  reviewed_at: string | null
  reviewer_name: string | null
}

export interface MerchantApplicationState {
  applications: MerchantApplication[]
}

export interface RejectionReasonOption {
  id: number
  scene: ReasonScene
  label: string
}

export interface ReviewInput {
  id: number
  decision: ReviewDecision
  reason_ids: number[]
  additional_note: string
}

export interface GoodsSubmissionInput extends GoodsInput {
  id?: number
  goods_id?: number
}

export interface GoodsSubmission extends GoodsInput {
  id: number
  goods_id: number | null
  merchant_id: number
  merchant_name: string
  action: GoodsSubmissionAction
  status: GoodsSubmissionStatus
  rejection_reason: string
  submitted_at: string | null
  reviewed_at: string | null
  reviewer_name: string | null
  created_at: string
  updated_at: string
}

export interface MerchantGoodsItem extends Goods {
  merchant_id: number | null
  sale_status: GoodsSaleStatus
  compliance_status: GoodsComplianceStatus
  compliance_reason: string
}

export interface EnforcementInput {
  expected_version: string
  confirmation_name?: string
  business_type: 'goods' | 'merchant'
  business_id: number
  action: EnforcementAction
  reason_ids: number[]
  additional_note: string
}

export interface EnforcementGoods extends MerchantGoodsItem {
  merchant_name: string
  user_id: number
  enforced_at: string | null
  enforcer_name: string | null
}

export interface ReviewRecord {
  record_source: string
  id: number
  business_type: ReviewScene
  business_id: number
  business_name: string
  merchant_name: string | null
  decision: ReviewDecision
  reason_snapshot: string[]
  additional_note: string
  reviewer_name: string
  reviewer_role: AdminRole
  created_at: string
}

export interface EnforcementRecord {
  parent_record_id: number | null
  id: number
  business_type: 'goods' | 'merchant'
  business_id: number
  business_name: string
  merchant_id: number
  merchant_name: string
  action: EnforcementAction
  previous_status: string
  next_status: string
  reason_snapshot: string[]
  additional_note: string
  operator_name: string
  operator_role: AdminRole
  created_at: string
}

export interface StockUpdateInput { id: number; stock: number }
export interface SaleStatusUpdateInput { id: number; sale_status: GoodsSaleStatus }

export type NotificationType =
  | 'merchant_application_approved'
  | 'merchant_application_rejected'
  | 'merchant_suspended'
  | 'merchant_restored'
  | 'merchant_revoked'
  | 'goods_approved'
  | 'goods_rejected'
  | 'goods_forced_off_sale'

export interface NotificationItem {
  id: number
  type: NotificationType
  title: string
  content: string
  business_type: ReviewScene | 'goods'
  business_id: number
  read_at: string | null
  created_at: string
}

export interface NotificationQuery {
  page?: number
  pagesize?: number
  unread_only?: boolean
}

export interface UnreadCount { count: number }

export type GovernanceTab = 'goods' | 'merchants' | 'reviews' | 'records'
export interface GovernanceQuery {
  page: number
  page_size: number
  keyword?: string
  merchant?: string
  status?: string
  operator?: string
  start_date?: string
  end_date?: string
}
export interface GovernancePage<T> { list: T[]; total: number }
export interface GovernancePreview {
  version: string
  name: string
  status: string
  goods_count: number
  pending_count: number
}
export interface GovernanceRecordDetail {
  record: Record<string, unknown>
  id: number
  snapshot: Record<string, unknown> | null
  current: Record<string, unknown> | null
  related: Array<{ id: number; kind: 'reviews' | 'records'; name: string; action: string }>
  parent_id: number | null
  source: string
}
