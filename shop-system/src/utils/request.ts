import axios, { AxiosHeaders, type AxiosRequestConfig, type AxiosResponse } from 'axios'
import type { ApiResponse } from '../../../shared/api'
import { unwrapResponse } from '../../../shared/response'
import useToken from '../stores/token'
import config from '../config'
import notification from './notification'
import router from '../router'
import useAdmin from '../stores/admin'
const baseURL = config.baseURL
const service = axios.create({ baseURL, timeout: 15000 })
service.interceptors.request.use(config=>{
  const token = useToken().token
    if(token){
        if (config.headers instanceof AxiosHeaders) config.headers.set('jwt', token)
        else {
          config.headers ??= {}
          config.headers.jwt = token
        }
    }
    return config
})
service.interceptors.response.use((response: AxiosResponse<ApiResponse<unknown>>) => {
  const { errno, errmsg } = response.data
  if (errno === 0) {
    return response
  }
  if(errno===2){
    notification({ message: errmsg, type: 'error' })
    useToken().removeToken()
    useAdmin().removeAdmin()
    if (router.currentRoute.value.name !== 'login') {
      router.replace({
        name: 'login',
        query: { redirect: router.currentRoute.value.fullPath }
      })
    }
  } else {
    notification({ message: errmsg || '请求失败', type: 'error' })
  }
  return Promise.reject(new Error(errmsg || '请求失败'))
}, (error: unknown) => {
    const message = axios.isAxiosError(error) && error.code === 'ECONNABORTED' ? '请求超时，请稍后重试' : '网络异常，请稍后重试'
    notification({ message, type: 'error' })
    return Promise.reject(error)
  })
export default {
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await service.get<ApiResponse<T>>(url, config)
    return unwrapResponse(response.data)
  },
  async post<T>(url: string, data: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await service.post<ApiResponse<T>>(url, data, config)
    return unwrapResponse(response.data)
  }
}
