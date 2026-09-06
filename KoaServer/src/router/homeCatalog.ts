import type { AppState } from '../types'
import Router from '@koa/router'
import * as homeCatalogController
  from '../controller/homeCatalog'

//创建公开商品路由
const router = new Router<AppState>({
  prefix: '/home'
})

router.get(
  '/category/list',
  homeCatalogController.categoryList
)

router.get(
  '/goods/list',
  homeCatalogController.goodsList
)

router.get(
  '/goods/detail',
  homeCatalogController.goodsDetail
)

router.get(
  '/goods/album',
  homeCatalogController.goodsAlbum
)

export default router