import router from './index'
import  useToken from '../stores/token'
import notification from '../utils/notification'
//路由守卫
const whiteList = ['/login','/index','/setting','/goods','/category']
router.beforeEach((to,from,next)=>{
  document.title = to.meta.title +'-'+'后台管理系统'
  const token = useToken()
  if(token.token){
    next()
  }
  else {
    if (whiteList.includes(to.path)) {
      next()
    }
    else {
      notification({
        message: '请先登录',
        type: 'error'
      })
      next('/login')
    }
  }
})
