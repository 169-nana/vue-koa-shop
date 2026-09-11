import type { AppState } from '../types'
//存放路由实例，将各个模块的路由挂载在实例上。最终将路由实例导出给app.js使用

import Router from '@koa/router'

import adminRouter from './admin'
import categoryRouter from './category'
import uploadRouter from './upload'
import goodsRouter from './goods'
import homeUserRouter from './homeUser'
import homeCatalogRouter from './homeCatalog'
import cartRouter from './cart'
import orderRouter from './order'
import addressRouter from './address'
import refundRouter from './refund'
import reviewRouter from './review'
import merchantRouter from './merchant'
import notificationRouter from './notification'
import moderationRouter from './moderation'
import governanceRouter from './governance'
import shopAgentRouter from './shopAgent'

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

// 挂载前台购物车路由
router.use(cartRouter.routes())
router.use(cartRouter.allowedMethods())

// 挂载前台订单路由
router.use(orderRouter.routes())
router.use(orderRouter.allowedMethods())

// 挂载前台收货地址路由
router.use(addressRouter.routes())
router.use(addressRouter.allowedMethods())

router.use(refundRouter.routes())
router.use(refundRouter.allowedMethods())
router.use(reviewRouter.routes())
router.use(reviewRouter.allowedMethods())
router.use(merchantRouter.routes())
router.use(merchantRouter.allowedMethods())
router.use(notificationRouter.routes())
router.use(notificationRouter.allowedMethods())
router.use(moderationRouter.routes())
router.use(moderationRouter.allowedMethods())
router.use(governanceRouter.routes())
router.use(governanceRouter.allowedMethods())

//挂载商家智能客服路由
router.use(shopAgentRouter.routes())
router.use(shopAgentRouter.allowedMethods())

export default router
