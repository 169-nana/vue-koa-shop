//存放分类查询请求的路由

const Router = require('@koa/router')

const auth = require('../middleware/auth')
const categoryController = require('../controller/category')

const router = new Router({
  prefix: '/admin/category'
})

//auth中间件会验证token，categoryController是操作分类数据的控制器
// 分类管理接口必须先登录，auth中间件会验证token，验证通过后才会执行categoryController.list
router.get('/list', auth, categoryController.list)

// 匹配 GET /admin/category/?id=1,参数查询  
router.get('/', auth, categoryController.detail)

// 匹配 POST /admin/category/add，新增请求
router.post('/add', auth, categoryController.add)

//匹配 POST /admin/category/save，修改请求
router.post('/save', auth, categoryController.save)

//匹配 POST /admin/category/del，删除请求
router.post('/del', auth, categoryController.remove)
module.exports = router