//存放路由实例，将各个模块的路由挂载在实例上。最终将路由实例导出给app.js使用

const Router = require('@koa/router')

const adminRouter = require('./admin.js')
const categoryRouter = require('./category')
const uploadRouter = require('./upload')
const goodsRouter = require('./goods')

const router = new Router()

//挂载登录模块路由
router.use(adminRouter.routes())
router.use(adminRouter.allowedMethods())

//挂载分类数据查询模块路由
router.use(categoryRouter.routes())
router.use(categoryRouter.allowedMethods())

//挂载图片上传模块路由
router.use(uploadRouter.routes())
router.use(uploadRouter.allowedMethods())

//挂载商品数据查询模块路由
router.use(goodsRouter.routes())
router.use(goodsRouter.allowedMethods())

module.exports = router
