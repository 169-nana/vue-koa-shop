import type { AppState } from '../types'
//存放分类查询请求的路由

import Router from '@koa/router'

import auth from '../middleware/auth'
import * as categoryController from '../controller/category'

const router = new Router<AppState>({
  prefix: '/admin/category'
})

// auth 中间件验证 Token，通过后才执行分类控制器
router.get('/list', auth, categoryController.list)

// 匹配 GET /admin/category/?id=1,参数查询  
router.get('/', auth, categoryController.detail)

// 匹配 POST /admin/category/add，新增请求
router.post('/add', auth, categoryController.add)

//匹配 POST /admin/category/save，修改请求
router.post('/save', auth, categoryController.save)

//匹配 POST /admin/category/del，删除请求
router.post('/del', auth, categoryController.remove)
export default router
