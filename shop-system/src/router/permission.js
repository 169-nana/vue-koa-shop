import router from './index'
import  useToken from '../stores/token'
import notification from '../utils/notification'
//路由守卫
router.beforeEach((to, from) => {
  document.title = `${to.meta.title || '页面'}-后台管理系统`
  const tokenStore = useToken()

  if (to.name === 'login' && tokenStore.token) {
    return { name: 'index' }
  }

  if (to.matched.some(record => record.meta.requiresAuth) && !tokenStore.token) {
    notification({ message: '请先登录', type: 'error' })
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  return true
})
