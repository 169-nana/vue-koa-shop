import type {
  AlbumImage,
  Category,
  CursorPageResult,
  Goods
} from '../../../shared/api'
import type { AppMiddleware } from '../types'
import * as categoryService from '../service/category'
import * as goodsService from '../service/goods'
import { fail, success } from '../utils/response'

// GET /home/category/list
export const categoryList:
  AppMiddleware<Category[]> = async ctx => {
    const categories =
      await categoryService.findAll()

    ctx.body = success(categories)
  }

// GET /home/goods/list
export const goodsList:
  AppMiddleware<CursorPageResult<Goods>> =
  async ctx => {
    /*
     * 查询字符串在运行时来自用户输入。
     * 即使前端把它声明成 number，
     * 后端收到的仍然可能是字符串或非法内容。
     */
    const lastId = Number(
      ctx.query.last_id ?? 0
    )

    const pagesize = Number(
      ctx.query.pagesize ?? 10
    )

    const categoryId = Number(
      ctx.query.category_id ?? 0
    )

    if (
      !Number.isInteger(lastId) ||
      lastId < 0
    ) {
      ctx.body = fail(
        'last_id必须是大于等于0的整数'
      )
      return
    }

    if (
      !Number.isInteger(pagesize) ||
      pagesize < 1 ||
      pagesize > 20
    ) {
      ctx.body = fail(
        '每页数量必须是1到20之间的整数'
      )
      return
    }

    if (
      !Number.isInteger(categoryId) ||
      categoryId < 0
    ) {
      ctx.body = fail(
        '商品分类不正确'
      )
      return
    }

    if (categoryId > 0) {
      const category =
        await categoryService.findById(
          categoryId
        )

      if (!category) {
        ctx.body = fail('分类不存在')
        return
      }
    }

    const rows =
      await goodsService.findPublicPage({
        lastId,
        pagesize,
        categoryId
      })

    const hasMore =
      rows.length > pagesize

    const list = rows.slice(0, pagesize)

    const lastGoods =
      list[list.length - 1]

    ctx.body = success({
      list,
      hasMore,
      nextLastId: lastGoods?.id ?? 0
    })
  }

// GET /home/goods/detail?id=1
export const goodsDetail:
  AppMiddleware<Goods> = async ctx => {
    const id = Number(ctx.query.id)

    if (
      !Number.isInteger(id) ||
      id <= 0
    ) {
      ctx.body = fail('商品ID不正确')
      return
    }

    const goods =
      await goodsService.findPublicById(id)

    if (!goods) {
      ctx.body = fail('商品不存在')
      return
    }

    ctx.body = success(goods)
  }

// GET /home/goods/album?goods_id=1
export const goodsAlbum:
  AppMiddleware<AlbumImage[]> =
  async ctx => {
    const goodsId = Number(
      ctx.query.goods_id
    )

    if (
      !Number.isInteger(goodsId) ||
      goodsId <= 0
    ) {
      ctx.body = fail('商品ID不正确')
      return
    }

    const goods =
      await goodsService.findPublicById(goodsId)

    if (!goods) {
      ctx.body = fail('商品不存在')
      return
    }

    const album =
      await goodsService
        .findAlbumByGoodsId(goodsId)

    ctx.body = success(album)
  }
