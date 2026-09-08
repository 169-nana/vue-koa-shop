import request from '../utils/request'
import config from '../config'
import type { ChangeAdminPasswordInput, UploadResult } from '../../../shared/api'
import type { Credentials, LoginResult, PublicAdmin, Category, CategoryInput, IdInput, InsertResult, GoodsInput, GoodsDetail, GoodsListItem, GoodsQuery, PageResult } from '../../../shared/api'
export const login = (data: Credentials) => request.post<LoginResult>('/admin/login', data)
export const getAdmin = () => request.get<PublicAdmin>('/admin/admin')
export const changeAdminPassword = (data: ChangeAdminPasswordInput) => request.post<null>('/admin/admin/changePassword', data)
export const uploadAdminAvatar = (file: File) => {
  const data = new FormData()
  data.append('type', 'admin_avatar')
  data.append('file', file)
  return request.post<UploadResult>('/admin/upload/picture', data)
}
export const changeAdminAvatar = (data: { avatar: string }) => request.post<{ avatar: string }>('/admin/admin/changeAvatar', data)
export const uploadPictureURL = () => config.baseURL + '/admin/upload/picture'
export const getCategoryList = () => request.get<Category[]>('/admin/category/list')
export const getCategory = (params: IdInput) => request.get<Category>('/admin/category/', { params })
export const addCategory = (data: CategoryInput) => request.post<InsertResult>('/admin/category/add', data)
export const editCategory = (data: Category) => request.post<Category>('/admin/category/save', data)
export const delCategory = (data: IdInput) => request.post<IdInput>('/admin/category/del', data)
export const getGoodsList = (params: GoodsQuery) => request.get<PageResult<GoodsListItem>>('/admin/goods/list', { params })
export const getGoods = (params: IdInput) => request.get<GoodsDetail>('/admin/goods', { params })
export const addGoods = (data: GoodsInput) => request.post<InsertResult>('/admin/goods/add', data)
export const editGoods = (data: GoodsInput & IdInput) => request.post<IdInput>('/admin/goods/save', data)
export const delGoods = (data: IdInput) => request.post<IdInput>('/admin/goods/del', data)
