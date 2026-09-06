import request from '../utils/request'

import type {
  AlbumImage,
  Category,
  Credentials,
  CursorPageResult,
  Goods,
  LoginResult,
  PublicGoodsQuery,
  PublicUser,
  RegisterResult
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