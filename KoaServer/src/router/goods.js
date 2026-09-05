const Router = require('@koa/router')

const auth = require('../middleware/auth')
const goodsController = require('../controller/goods')

const router = new Router({
  prefix: '/admin/goods'
})

router.get(
  '/list',
  auth,
  goodsController.list
)

router.get(
  '/',
  auth,
  goodsController.detail
)

router.post(
  '/add',
  auth,
  goodsController.add
)

router.post(
  '/save',
  auth,
  goodsController.save
)

router.post(
  '/del',
  auth,
  goodsController.remove
)

module.exports = router
