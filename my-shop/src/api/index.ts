import request from '../utils/request'

import type {
  AlbumImage,
  AddCartInput,
  AddressInput,
  CartItem,
  Category,
  CreateRefundInput,
  CreateReviewInput,
  CreateOrderInput,
  CreateOrderResult,
  Credentials,
  CursorPageResult,
  Goods,
  GoodsReview,
  InsertResult,
  LoginResult,
  OrderDetail,
  OrderStatus,
  OrderSummary,
  PublicGoodsQuery,
  PublicGoodsDetail,
  PublicUser,
  RefundApplication,
  RegisterResult,
  ReviewableItem,
  UpdateAddressInput,
  UpdateCartInput,
  UploadResult,
  UserAddress,
  UserDashboard,
  GoodsSubmission,
  GoodsSubmissionInput,
  MerchantApplicationSubmitInput,
  MerchantApplicationState,
  MerchantGoodsItem,
  NotificationItem,
  NotificationQuery,
  PageResult,
  SaleStatusUpdateInput,
  ShopAgentChatInput,
  ShopAgentActionInput,
  ShopAgentActionResult,
  ShopAgentPendingAction,
  ShopAgentReply,
  ShopAgentStreamEvent,
  StockUpdateInput,
  UnreadCount
} from '../../../shared/api'
import config from '../config'

// 用户注册
export const register = (
  data: Credentials
) => request.post<RegisterResult>(
  '/home/register',
  data
)

// 用户登录
export const login = (
  data: Credentials
) => request.post<LoginResult>(
  '/home/login',
  data
)

// 获取当前用户
export const getUser = () =>
  request.get<PublicUser>('/home/user')

// 获取公开分类
export const getCategories = () =>
  request.get<Category[]>(
    '/home/category/list'
  )

// 获取公开商品列表
export const getGoodsList = (
  params: PublicGoodsQuery = {}
) =>
  request.get<CursorPageResult<Goods>>(
    '/home/goods/list',
    {
      params
    }
  )

// 获取商品详情
export const getGoodsDetail = (
  id: number
) =>
  request.get<PublicGoodsDetail>(
    '/home/goods/detail',
    {
      params: {
        id
      }
    }
  )

// 获取商品相册
export const getGoodsAlbum = (
  goodsId: number
) =>
  request.get<AlbumImage[]>(
    '/home/goods/album',
    {
      params: {
        goods_id: goodsId
      }
    }
  )

export const getCart = () =>
  request.get<CartItem[]>('/home/cart')

export const addCart = (data: AddCartInput) =>
  request.post<null>('/home/cart/add', data)

export const updateCart = (data: UpdateCartInput) =>
  request.post<null>('/home/cart/update', data)

export const removeCart = (id: number) =>
  request.post<null>('/home/cart/remove', { id })

export const createOrder = (data: CreateOrderInput) =>
  request.post<CreateOrderResult>('/home/order/create', data)

export const getOrders = (status?: OrderStatus) =>
  request.get<OrderSummary[]>('/home/order/list', {
    params: status ? { status } : undefined
  })

export const getOrderDetail = (id: number) =>
  request.get<OrderDetail>('/home/order/detail', { params: { id } })

export const cancelOrder = (id: number) =>
  request.post<null>('/home/order/cancel', { id })

export const getAddresses = () =>
  request.get<UserAddress[]>('/home/address/list')

export const addAddress = (data: AddressInput) =>
  request.post<InsertResult>('/home/address/add', data)

export const updateAddress = (data: UpdateAddressInput) =>
  request.post<null>('/home/address/update', data)

export const setDefaultAddress = (id: number) =>
  request.post<null>('/home/address/default', { id })

export const removeAddress = (id: number) =>
  request.post<null>('/home/address/remove', { id })

export const getUserDashboard = () =>
  request.get<UserDashboard>('/home/user/dashboard')

export const uploadUserAvatar = (file: File) => {
  const data = new FormData()
  data.append('file', file)
  data.append('type', 'user_avatar')
  return request.post<UploadResult>('/home/user/avatar/upload', data)
}

export const changeUserAvatar = (avatar: string) =>
  request.post<{ avatar: string }>('/home/user/avatar', { avatar })

export const getRefunds = () =>
  request.get<RefundApplication[]>('/home/refund/list')

export const createRefund = (data: CreateRefundInput) =>
  request.post<InsertResult>('/home/refund/create', data)

export const getReviewableItems = () =>
  request.get<ReviewableItem[]>('/home/review/reviewable')

export const createReview = (data: CreateReviewInput) =>
  request.post<InsertResult>('/home/review/create', data)

export const getGoodsReviews = (goodsId: number) =>
  request.get<GoodsReview[]>('/home/review/goods', {
    params: { goods_id: goodsId }
  })

export const getMerchantApplications = () => request.get<MerchantApplicationState>('/home/merchant/application')
export const submitMerchantApplication = (data: MerchantApplicationSubmitInput) =>
  request.post<InsertResult>('/home/merchant/application/submit', data)
const uploadMerchantImage = (url: string, type: string, file: File) => {
  const data = new FormData()
  data.append('type', type)
  data.append('file', file)
  return request.post<UploadResult>(url, data)
}
export const uploadMerchantQualification = (file: File) =>
  uploadMerchantImage('/home/merchant/qualification/upload', 'merchant_qualification', file)
export const uploadMerchantGoodsImage = (merchantId: number, file: File, type: 'goods_picture' | 'goods_album') => {
  const data = new FormData()
  data.append('type', type)
  data.append('file', file)
  return request.post<UploadResult>('/home/merchant/upload/picture', data, { params: { merchant_id: merchantId } })
}
const merchantParams = (merchantId: number) => ({ params: { merchant_id: merchantId } })
export const getMerchantSubmissions = (merchantId: number) =>
  request.get<GoodsSubmission[]>('/home/merchant/goods/submissions', merchantParams(merchantId))
export const saveMerchantSubmission = (merchantId: number, data: GoodsSubmissionInput) =>
  request.post<InsertResult>('/home/merchant/goods/submission/save', data, merchantParams(merchantId))
export const submitMerchantGoods = (merchantId: number, id: number) =>
  request.post<null>('/home/merchant/goods/submission/submit', { id }, merchantParams(merchantId))
export const getMerchantGoods = (merchantId: number) =>
  request.get<MerchantGoodsItem[]>('/home/merchant/goods/list', merchantParams(merchantId))
export const updateMerchantStock = (merchantId: number, data: StockUpdateInput) =>
  request.post<StockUpdateInput>('/home/merchant/goods/stock', data, merchantParams(merchantId))
export const updateMerchantSaleStatus = (merchantId: number, data: SaleStatusUpdateInput) =>
  request.post<SaleStatusUpdateInput>('/home/merchant/goods/sale-status', data, merchantParams(merchantId))
export const getNotifications = (params: NotificationQuery = {}) =>
  request.get<PageResult<NotificationItem>>('/home/notifications', { params })
export const getUnreadNotificationCount = () => request.get<UnreadCount>('/home/notifications/unread-count')
export const readNotification = (id: number) => request.post<null>('/home/notifications/read', { id })
export const readAllNotifications = () => request.post<null>('/home/notifications/read-all', {})

export const chatWithShopAgent = (
  data: ShopAgentChatInput,
  authenticated: boolean
) => request.post<ShopAgentReply>(
  authenticated ? '/home/agent/chat-auth' : '/home/agent/chat',
  data,
  { timeout: 45000 }
)

export interface ShopAgentStreamHandlers {
  onDelta: (content: string) => void
  onReset: () => void
  onProducts: (products: Goods[]) => void
  onAction: (action: ShopAgentPendingAction) => void
}

function isStreamEvent(value: unknown): value is ShopAgentStreamEvent {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false
  if (value.type === 'done' || value.type === 'reset') return true
  if (value.type === 'delta') return 'content' in value && typeof value.content === 'string'
  if (value.type === 'error') return 'message' in value && typeof value.message === 'string'
  if (value.type === 'action') {
    if (!('action' in value) || typeof value.action !== 'object' || value.action === null) {
      return false
    }
    const action = value.action
    return 'type' in action && action.type === 'add_to_cart' &&
      'token' in action && typeof action.token === 'string' &&
      'title' in action && typeof action.title === 'string' &&
      'description' in action && typeof action.description === 'string' &&
      'expires_at' in action && typeof action.expires_at === 'string'
  }
  return value.type === 'products' && 'products' in value && Array.isArray(value.products)
}

function responseError(value: unknown): string {
  if (
    typeof value === 'object' &&
    value !== null &&
    'errmsg' in value &&
    typeof value.errmsg === 'string' &&
    value.errmsg
  ) {
    return value.errmsg
  }
  return '智能助手暂时不可用，请稍后重试'
}

export async function streamWithShopAgent(
  data: ShopAgentChatInput,
  token: string,
  handlers: ShopAgentStreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  const response = await fetch(
    `${config.baseURL}/home/agent/${token ? 'stream-auth' : 'stream'}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { jwt: token } : {})
      },
      body: JSON.stringify(data),
      signal
    }
  )

  const contentType = response.headers.get('content-type') ?? ''
  if (!response.ok || !contentType.includes('text/event-stream')) {
    const body: unknown = await response.json().catch(() => null)
    throw new Error(responseError(body))
  }
  if (!response.body) throw new Error('浏览器不支持流式响应')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const processBlock = (block: string): void => {
    const dataLine = block
      .split('\n')
      .find(line => line.startsWith('data: '))
    if (!dataLine) return

    const parsed: unknown = JSON.parse(dataLine.slice(6))
    if (!isStreamEvent(parsed)) throw new Error('智能助手返回了无法识别的数据')

    if (parsed.type === 'delta') handlers.onDelta(parsed.content)
    if (parsed.type === 'reset') handlers.onReset()
    if (parsed.type === 'products') handlers.onProducts(parsed.products)
    if (parsed.type === 'action') handlers.onAction(parsed.action)
    if (parsed.type === 'error') throw new Error(parsed.message)
  }

  while (true) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value, { stream: !done })
    const blocks = buffer.split('\n\n')
    buffer = blocks.pop() ?? ''
    blocks.forEach(processBlock)
    if (done) break
  }

  if (buffer.trim()) processBlock(buffer)
}

export const confirmAgentAddToCart = (data: ShopAgentActionInput) =>
  request.post<ShopAgentActionResult>('/home/agent/actions/add-to-cart', data)

export const trackAgentProductClick = (goodsId: number, authenticated: boolean) =>
  request.post<null>(
    authenticated
      ? '/home/agent/events/product-click-auth'
      : '/home/agent/events/product-click',
    { goods_id: goodsId }
  )
