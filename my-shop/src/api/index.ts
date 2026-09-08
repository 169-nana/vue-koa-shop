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
  UserDashboard
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
