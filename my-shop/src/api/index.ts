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
  MerchantApplicationInput,
  MerchantApplicationState,
  MerchantGoodsItem,
  NotificationItem,
  NotificationQuery,
  PageResult,
  SaleStatusUpdateInput,
  StockUpdateInput,
  UnreadCount
} from '../../../shared/api'

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
  request.get<Goods>(
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

export const getMerchantApplication = () => request.get<MerchantApplicationState>('/home/merchant/application')
export const submitMerchantApplication = (data: MerchantApplicationInput) =>
  request.post<InsertResult>('/home/merchant/application/submit', data)
const uploadMerchantImage = (url: string, type: string, file: File) => {
  const data = new FormData()
  data.append('type', type)
  data.append('file', file)
  return request.post<UploadResult>(url, data)
}
export const uploadMerchantQualification = (file: File) =>
  uploadMerchantImage('/home/merchant/qualification/upload', 'merchant_qualification', file)
export const uploadMerchantGoodsImage = (file: File, type: 'goods_picture' | 'goods_album') =>
  uploadMerchantImage('/home/merchant/upload/picture', type, file)
export const getMerchantSubmissions = () => request.get<GoodsSubmission[]>('/home/merchant/goods/submissions')
export const saveMerchantSubmission = (data: GoodsSubmissionInput) =>
  request.post<InsertResult>('/home/merchant/goods/submission/save', data)
export const submitMerchantGoods = (id: number) =>
  request.post<null>('/home/merchant/goods/submission/submit', { id })
export const getMerchantGoods = () => request.get<MerchantGoodsItem[]>('/home/merchant/goods/list')
export const updateMerchantStock = (data: StockUpdateInput) =>
  request.post<StockUpdateInput>('/home/merchant/goods/stock', data)
export const updateMerchantSaleStatus = (data: SaleStatusUpdateInput) =>
  request.post<SaleStatusUpdateInput>('/home/merchant/goods/sale-status', data)
export const getNotifications = (params: NotificationQuery = {}) =>
  request.get<PageResult<NotificationItem>>('/home/notifications', { params })
export const getUnreadNotificationCount = () => request.get<UnreadCount>('/home/notifications/unread-count')
export const readNotification = (id: number) => request.post<null>('/home/notifications/read', { id })
export const readAllNotifications = () => request.post<null>('/home/notifications/read-all', {})
