// 引入请求模块,request模块里包含了axios的配置和拦截器
import request from '../utils/request'
import config from '../config'
// 登录接口
export const login = (data) => {
  return request.post('/admin/login',data)
}
// 获取管理员信息接口
export function getAdmin() {
  return request.get('/admin/admin')
}
//修改密码接口
export function changeAdminPassword(data) {
  return request.post('/admin/admin/changePassword',data)
}
//修改头像接口
export function changeAdminAvatar(data) {
  return request.post('/admin/admin/changeAvatar',data)
}
//更新图片地址
export function uploadPictureURL(data) {
  return config.baseURL+'/admin/upload/picture'
}
