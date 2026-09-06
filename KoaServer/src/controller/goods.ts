import type { InsertResult, IdInput, PageResult, GoodsListItem, GoodsDetail } from '../../../shared/api'
import type { AppMiddleware } from '../types'
import { getBody } from '../utils/input'
import * as goodsService from '../service/goods'
import { success, fail } from '../utils/response'
import * as categoryService from '../service/category'

// GET /admin/goods/list 分页列表查询
export const list: AppMiddleware<PageResult<GoodsListItem>> = async ctx => {
  const page = Number(ctx.query.page ?? 1)
  const pagesize = Number(
    ctx.query.pagesize ?? 10
  )

  // 验证页码和每页数量的合法性
  if (!Number.isInteger(page) || page <= 0) {
    ctx.body = fail('页码不正确')
    return
  }

  // 验证每页数量的合法性
  if (
    !Number.isInteger(pagesize) ||
    pagesize <= 0 ||
    pagesize > 100
  ) {
    ctx.body = fail(
      '每页数量必须是1到100之间的整数'
    )
    return
  }

  const offset = (page - 1) * pagesize

  const keyword = typeof ctx.query.keyword === 'string' ? ctx.query.keyword.trim() : ''
  const categoryId = ctx.query.category_id ? Number(ctx.query.category_id) : null
  const minPrice = ctx.query.min_price === undefined || ctx.query.min_price === '' ? null : Number(ctx.query.min_price)
  const maxPrice = ctx.query.max_price === undefined || ctx.query.max_price === '' ? null : Number(ctx.query.max_price)
  const minStock = ctx.query.min_stock === undefined || ctx.query.min_stock === '' ? null : Number(ctx.query.min_stock)
  const maxStock = ctx.query.max_stock === undefined || ctx.query.max_stock === '' ? null : Number(ctx.query.max_stock)

  if (keyword.length > 50) { ctx.body = fail('查询关键词不能超过50个字符'); return }
  if (categoryId !== null && (!Number.isInteger(categoryId) || categoryId <= 0)) { ctx.body = fail('商品分类不正确'); return }
  if ([minPrice, maxPrice].some(value => value !== null && (!Number.isFinite(value) || value < 0))) { ctx.body = fail('价格区间不正确'); return }
  if ([minStock, maxStock].some(value => value !== null && (!Number.isInteger(value) || value < 0))) { ctx.body = fail('库存区间不正确'); return }
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) { ctx.body = fail('最低价格不能高于最高价格'); return }
  if (minStock !== null && maxStock !== null && minStock > maxStock) { ctx.body = fail('最低库存不能高于最高库存'); return }

  const filters = { keyword, categoryId, minPrice, maxPrice, minStock, maxStock }

  const list = await goodsService.findPage({
    offset,
    pagesize,
    ...filters
  })

  // 查询总数
  const total = await goodsService.countAll(filters)

  //将总数和列表数据拼接成一个对象返回给前端
  ctx.body = success({
    total,
    list
  })
}

// GET /admin/goods?id=1 根据id查询商品详情
export const detail: AppMiddleware<GoodsDetail> = async ctx => {
  const id = Number(ctx.query.id)

  // 验证商品ID的合法性
  if (!Number.isInteger(id) || id <= 0) {
    ctx.body = fail('商品ID不正确')
    return
  }

  const goods = await goodsService.findById(id)

  if (!goods) {
    ctx.body = fail('商品不存在')
    return
  }

  // 查询商品相册
  const album =
    await goodsService.findAlbumByGoodsId(id)

  ctx.body = success({
    ...goods,
    album
  })
}

// POST /admin/goods/add  实现商品新增
export const add: AppMiddleware<InsertResult> = async ctx => {
  const body = getBody(ctx.request.body)

  const name = typeof body.name === 'string'
    ? body.name.trim()
    : ''

  const categoryId = Number(body.category_id)
  const stock = Number(body.stock)

  const picture =
    typeof body.picture === 'string'
      ? body.picture.trim()
      : ''

  const spec =
    typeof body.spec === 'string'
      ? body.spec.trim()
      : ''

  const description =
    typeof body.description === 'string'
      ? body.description.trim()
      : ''

  const album = Array.isArray(body.album)
    ? body.album.map((item: unknown) =>
        typeof item === 'string'
          ? item.trim()
          : ''
      )
    : null

  /*
   * 将价格保留为字符串检查。
   * DECIMAL(10, 2)：
   * 最多8位整数、2位小数。
   */
  const priceText = String(
    body.price ?? ''
  ).trim()

  if (!name) {
    ctx.body = fail('商品名称不能为空')
    return
  }

  if (name.length > 255) {
    ctx.body = fail('商品名称过长')
    return
  }

  if (
    !Number.isInteger(categoryId) ||
    categoryId <= 0
  ) {
    ctx.body = fail('商品分类不正确')
    return
  }

  if (
    !/^\d{1,8}(\.\d{1,2})?$/.test(
      priceText
    )
  ) {
    ctx.body = fail(
      '商品价格必须是有效的非负金额，最多保留两位小数'
    )
    return
  }

  if (
    !Number.isInteger(stock) ||
    stock < 0 ||
    stock > 2147483647
  ) {
    ctx.body = fail(
      '商品库存必须是有效的非负整数'
    )
    return
  }

  if (!picture) {
    ctx.body = fail('请上传商品主图')
    return
  }

  if (picture.length > 255) {
    ctx.body = fail('商品图片地址过长')
    return
  }

  if (spec.length > 255) {
    ctx.body = fail('商品规格过长')
    return
  }

  if (!album) {
    ctx.body = fail('商品相册格式不正确')
    return
  }

  if (album.length > 10) {
    ctx.body = fail('商品相册最多上传10张图片')
    return
  }

  if (
    album.some(
      picture =>
        !picture ||
        picture.length > 255
    )
  ) {
    ctx.body = fail('商品相册图片地址不正确')
    return
  }

  // 商品必须属于二级分类
  const category =
    await categoryService.findById(categoryId)

  if (!category) {
    ctx.body = fail('商品分类不存在')
    return
  }

  if (category.pid === 0) {
    ctx.body = fail('商品必须选择二级分类')
    return
  }

  const insertId =
    await goodsService.createWithAlbum(
      {
        category_id: categoryId,
        name,
        price: priceText,
        picture,
        stock,
        spec,
        description
      },
      album
    )

  ctx.body = success({ insertId })
}

// POST /admin/goods/save  实现商品修改
export const save: AppMiddleware<IdInput> = async ctx => {
  const body = getBody(ctx.request.body)

  const id = Number(body.id)
  const categoryId = Number(body.category_id)
  const stock = Number(body.stock)

  const name = typeof body.name === 'string'
    ? body.name.trim()
    : ''

  const picture =
    typeof body.picture === 'string'
      ? body.picture.trim()
      : ''

  const spec =
    typeof body.spec === 'string'
      ? body.spec.trim()
      : ''

  const description =
    typeof body.description === 'string'
      ? body.description.trim()
      : ''

  const priceText = String(
    body.price ?? ''
  ).trim()

  const album = Array.isArray(body.album)
    ? body.album.map((item: unknown) =>
        typeof item === 'string'
          ? item.trim()
          : ''
      )
    : null

  if (!Number.isInteger(id) || id <= 0) {
    ctx.body = fail('商品ID不正确')
    return
  }

  if (!name || name.length > 255) {
    ctx.body = fail('商品名称不正确')
    return
  }

  if (
    !Number.isInteger(categoryId) ||
    categoryId <= 0
  ) {
    ctx.body = fail('商品分类不正确')
    return
  }

  if (
    !/^\d{1,8}(\.\d{1,2})?$/.test(
      priceText
    )
  ) {
    ctx.body = fail(
      '商品价格必须是有效的非负金额，最多保留两位小数'
    )
    return
  }

  if (
    !Number.isInteger(stock) ||
    stock < 0 ||
    stock > 2147483647
  ) {
    ctx.body = fail(
      '商品库存必须是有效的非负整数'
    )
    return
  }

  if (!picture || picture.length > 255) {
    ctx.body = fail('商品主图不正确')
    return
  }

  if (spec.length > 255) {
    ctx.body = fail('商品规格过长')
    return
  }

  if (!album) {
    ctx.body = fail('商品相册格式不正确')
    return
  }

  if (album.length > 10) {
    ctx.body = fail('商品相册最多上传10张图片')
    return
  }

  if (
    album.some(
      picture =>
        !picture ||
        picture.length > 255
    )
  ) {
    ctx.body = fail('商品相册图片地址不正确')
    return
  }

  const goods = await goodsService.findById(id)

  if (!goods) {
    ctx.body = fail('修改失败，商品不存在')
    return
  }

  const category =
    await categoryService.findById(categoryId)

  if (!category) {
    ctx.body = fail('商品分类不存在')
    return
  }

  if (category.pid === 0) {
    ctx.body = fail('商品必须选择二级分类')
    return
  }

  await goodsService.updateWithAlbum(
    {
      id,
      category_id: categoryId,
      name,
      price: priceText,
      picture,
      stock,
      spec,
      description
    },
    album
  )

  ctx.body = success({ id })
}

// POST /admin/goods/del  实现商品删除
export const remove: AppMiddleware<IdInput> = async ctx => {
  const id = Number(
    (getBody(ctx.request.body)).id
  )

  if (!Number.isInteger(id) || id <= 0) {
    ctx.body = fail('商品ID不正确')
    return
  }

  const goods = await goodsService.findById(id)

  if (!goods) {
    ctx.body = fail('删除失败，商品不存在')
    return
  }

  await goodsService.removeWithAlbum(id)

  ctx.body = success({ id })
}
