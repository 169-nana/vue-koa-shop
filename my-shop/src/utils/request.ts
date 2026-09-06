import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios'
import type { ApiResponse } from '../../../shared/api'
import { unwrapResponse } from '../../../shared/response'

import config from '../config'
import useTokenStore from '../stores/token'
import useUserStore from '../stores/user'
import router from '../router'

const request = axios.create({
  baseURL: config.baseURL,
  timeout: 15000
})

// 发送请求前自动携带用户Token
request.interceptors.request.use(
  requestConfig => {
    const tokenStore = useTokenStore()

    if (tokenStore.token) {
      requestConfig.headers.jwt =
        tokenStore.token
    }

    return requestConfig
  }
)

// 统一处理后端响应
request.interceptors.response.use(
  (response: AxiosResponse<ApiResponse<unknown>>) => {
    const {
      errno,
      errmsg
    } = response.data

    if (errno === 0) {
      return response
    }

    if (errno === 2) {
      const tokenStore = useTokenStore()
      const userStore = useUserStore()

      tokenStore.removeToken()
      userStore.removeUser()

      if (
        router.currentRoute.value.name !==
        'login'
      ) {
        router.replace({
          name: 'login',
          query: {
            redirect:
              router.currentRoute.value.fullPath
          }
        })
      }
    }

    return Promise.reject(
      new Error(errmsg || '请求失败')
    )
  },

  (error: unknown) => {
    const message =
      axios.isAxiosError(error) && error.code === 'ECONNABORTED'
        ? '请求超时，请稍后重试'
        : '网络异常，请稍后重试'

    return Promise.reject(
      new Error(message)
    )
  }
)

export default {
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await request.get<ApiResponse<T>>(url, config)
    return unwrapResponse(response.data)
  },
  async post<T>(url: string, data: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await request.post<ApiResponse<T>>(url, data, config)
    return unwrapResponse(response.data)
  }
}
