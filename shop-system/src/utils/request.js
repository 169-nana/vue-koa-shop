import axios from 'axios'
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
        config.headers.jwt = token
    }
    return config
})
service.interceptors.response.use(response=>{
  const { errno, data, errmsg } = response.data
  if (errno === 0) {
    return data ?? true
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
}, error => {
    const message = error.code === 'ECONNABORTED' ? '请求超时，请稍后重试' : '网络异常，请稍后重试'
    notification({ message, type: 'error' })
    return Promise.reject(error)
  })
export default service
