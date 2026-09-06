import type { AppState } from '../types'
//存放路由实例，将各个模块的路由挂载在实例上。最终将路由实例导出给app.js使用

import Router from '@koa/router'

import adminRouter from './admin'
import categoryRouter from './category'
import uploadRouter from './upload'
import goodsRouter from './goods'
import homeUserRouter from './homeUser'
import homeCatalogRouter from './homeCatalog'

const router = new Router<AppState>()

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

//挂载前端用户注册模块路由
router.use(homeUserRouter.routes())
router.use(homeUserRouter.allowedMethods())

// 挂载前台公开分类和商品路由
router.use(homeCatalogRouter.routes())
router.use(homeCatalogRouter.allowedMethods())

export default router
