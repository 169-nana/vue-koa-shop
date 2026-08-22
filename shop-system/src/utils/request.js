import axios from 'axios'
import useToken from '../stores/token'
import config from '../config'
import notification from './notification'
import router from '../router'
const baseURL = config.baseURL
const service = axios.create({baseURL})
service.interceptors.request.use(config=>{
    loadingInstance=ElLoading.service()
  const token = useToken().token
    if(token){
        config.headers.jwt = token
    }
    return config
})
service.interceptors.response.use(response=>{
  const { errno, data, errmsg } = response.data
  if (errno === 0) {
    if(errmsg!==''){
      notification({ message: errmsg, type: 'success' })
    }
    return data||true
  }
  if(errno===2){
    notification({ message: errmsg, type: 'error' })
    router.push({ name: 'login' })
    return false
  }
  notification({ message: errmsg || '请求失败', type: 'error' })
  return false
},error => {
    notification({ message: '请求失败', type: 'error' })
    console.log(error)
    return false
  })
export default service
