import type { ApiResponse, UploadResult } from '../../../shared/api'
import router from '../router'
import useAdmin from '../stores/admin'
import useToken from '../stores/token'
import notification from './notification'

const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export const validateImage = (file: File, maxSizeKB = 500) => {
  if (!imageTypes.includes(file.type)) {
    notification({ message: '只能上传 JPG、PNG、WebP 或 GIF 图片', type: 'warning' })
    return false
  }
  if (file.size > maxSizeKB * 1024) {
    notification({ message: `图片大小不能超过 ${maxSizeKB}KB`, type: 'warning' })
    return false
  }
  return true
}

export const handleUploadUnauthorized = (response: ApiResponse<UploadResult> | undefined) => {
  if (response?.errno !== 2) return false

  notification({
    message: response.errmsg || '用户未登录或登录已过期',
    type: 'error'
  })
  useToken().removeToken()
  useAdmin().removeAdmin()
  if (router.currentRoute.value.name !== 'login') {
    router.replace({
      name: 'login',
      query: { redirect: router.currentRoute.value.fullPath }
    })
  }
  return true
}
