//存放管理员模块路由
const Router = require('@koa/router')
const controller = require('../controller/admin.js')
const auth = require('../middleware/auth.js')

const router = new Router({
  prefix: '/admin'
})

//登录接口 - 不需要鉴权，使用 POST 方法接收表单
router.post('/login', controller.login)
//获取管理员信息 - 需要鉴权
router.get('/admin', auth, controller.getAdmin)
//更改管理员密码接口
router.post('/admin/changePassword', auth, controller.changePassword)
//更改管理员头像接口
router.post('/admin/changeAvatar', auth, controller.changeAvatar)

module.exports = router
