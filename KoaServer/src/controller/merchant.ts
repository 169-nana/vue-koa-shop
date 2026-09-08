import type {
  GoodsSubmission,
  InsertResult,
  MerchantApplicationState,
  MerchantGoodsItem,
  SaleStatusUpdateInput,
  StockUpdateInput
} from '../../../shared/api'
import type { AppMiddleware } from '../types'
import { containsImageMarkup, getBody, AppError, hasErrorCode } from '../utils/input'
import { fail, success } from '../utils/response'
import { requireUser } from '../utils/identity'
import * as merchantService from '../service/merchant'
import * as categoryService from '../service/category'

const imagePathPattern = /^uploads\/[0-9a-f-]+\.(?:jpg|png|webp|gif)$/i

function appErrorMessage(error: unknown): string | null {
  return error instanceof AppError ? error.message : null
}

export const getApplication: AppMiddleware<MerchantApplicationState> = async ctx => {
  ctx.body = success({ application: await merchantService.findApplicationByUserId(requireUser(ctx).id) })
}

export const submitApplication: AppMiddleware<InsertResult> = async ctx => {
  const body = getBody(ctx.request.body)
  const shopName = typeof body.shop_name === 'string' ? body.shop_name.trim() : ''
  const contactName = typeof body.contact_name === 'string' ? body.contact_name.trim() : ''
  const contactPhone = typeof body.contact_phone === 'string' ? body.contact_phone.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  const qualificationPicture = typeof body.qualification_picture === 'string'
    ? body.qualification_picture.trim() : ''
  if (shopName.length < 2 || shopName.length > 100) { ctx.body = fail('店铺名称必须是2到100个字符'); return }
  if (contactName.length < 2 || contactName.length > 50) { ctx.body = fail('联系人必须是2到50个字符'); return }
  if (!/^[0-9+\-\s]{6,30}$/.test(contactPhone)) { ctx.body = fail('联系电话格式不正确'); return }
  if (description.length > 1000) { ctx.body = fail('店铺简介不能超过1000个字符'); return }
  if (!imagePathPattern.test(qualificationPicture)) { ctx.body = fail('请上传有效的资质图片'); return }
  try {
    const insertId = await merchantService.submitApplication(requireUser(ctx).id, {
      shop_name: shopName, contact_name: contactName, contact_phone: contactPhone,
      description, qualification_picture: qualificationPicture
    })
    ctx.body = success({ insertId })
  } catch (error) {
    const message = appErrorMessage(error)
    if (message) { ctx.body = fail(message); return }
    if (hasErrorCode(error, 'ER_DUP_ENTRY')) { ctx.body = fail('店铺名称已经被使用'); return }
    throw error
  }
}

type ValidGoodsInput = {
  id?: number; goods_id?: number; name: string; category_id: number; price: string; stock: number
  picture: string; album: string[]; spec: string; description: string
}

async function validateGoodsBody(value: unknown): Promise<{ data?: ValidGoodsInput; error?: string }> {
  const body = getBody(value)
  const id = body.id === undefined ? undefined : Number(body.id)
  const goodsId = body.goods_id === undefined ? undefined : Number(body.goods_id)
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const categoryId = Number(body.category_id)
  const price = String(body.price ?? '').trim()
  const stock = Number(body.stock)
  const picture = typeof body.picture === 'string' ? body.picture.trim() : ''
  const spec = typeof body.spec === 'string' ? body.spec.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  const album = Array.isArray(body.album) ? body.album.map(item => typeof item === 'string' ? item.trim() : '') : []
  if (id !== undefined && (!Number.isInteger(id) || id <= 0)) return { error: '商品草稿ID不正确' }
  if (goodsId !== undefined && (!Number.isInteger(goodsId) || goodsId <= 0)) return { error: '商品ID不正确' }
  if (!name || name.length > 255) return { error: '商品名称不能为空且不能超过255个字符' }
  if (!Number.isInteger(categoryId) || categoryId <= 0) return { error: '商品分类不正确' }
  const category = await categoryService.findById(categoryId)
  if (!category || category.pid === 0) return { error: '请选择有效的二级分类' }
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(price)) return { error: '商品价格格式不正确，最多保留两位小数' }
  if (!Number.isInteger(stock) || stock < 0 || stock > 2147483647) return { error: '商品库存必须是非负整数' }
  if (!imagePathPattern.test(picture)) return { error: '请上传有效的商品主图' }
  if (album.length > 20 || album.some(path => !imagePathPattern.test(path))) return { error: '商品相册图片不正确或超过20张' }
  if (spec.length > 255) return { error: '商品规格不能超过255个字符' }
  if (description.length > 10000 || containsImageMarkup(description)) return { error: '商品介绍不能超过10000个字符且不能包含图片' }
  return { data: { id, goods_id: goodsId, name, category_id: categoryId, price, stock, picture, album, spec, description } }
}

export const listSubmissions: AppMiddleware<GoodsSubmission[]> = async ctx => {
  ctx.body = success(await merchantService.listSubmissions(ctx.state.merchant!.id))
}

export const getSubmission: AppMiddleware<GoodsSubmission> = async ctx => {
  const id = Number(ctx.query.id)
  if (!Number.isInteger(id) || id <= 0) { ctx.body = fail('商品草稿ID不正确'); return }
  const item = await merchantService.findSubmission(id, ctx.state.merchant!.id)
  if (!item) { ctx.body = fail('商品草稿不存在'); return }
  ctx.body = success(item)
}

export const saveSubmission: AppMiddleware<InsertResult> = async ctx => {
  const result = await validateGoodsBody(ctx.request.body)
  if (!result.data) { ctx.body = fail(result.error ?? '商品资料不正确'); return }
  try {
    const insertId = await merchantService.saveSubmission(ctx.state.merchant!.id, result.data)
    ctx.body = success({ insertId })
  } catch (error) {
    const message = appErrorMessage(error)
    if (message) { ctx.body = fail(message); return }
    throw error
  }
}

export const submitGoods: AppMiddleware<null> = async ctx => {
  const id = Number(getBody(ctx.request.body).id)
  if (!Number.isInteger(id) || id <= 0) { ctx.body = fail('商品草稿ID不正确'); return }
  try { await merchantService.submitGoods(ctx.state.merchant!.id, id); ctx.body = success() }
  catch (error) { const message = appErrorMessage(error); if (message) { ctx.body = fail(message); return }; throw error }
}

export const listGoods: AppMiddleware<MerchantGoodsItem[]> = async ctx => {
  ctx.body = success(await merchantService.listGoods(ctx.state.merchant!.id))
}

export const updateStock: AppMiddleware<StockUpdateInput> = async ctx => {
  const body = getBody(ctx.request.body), id = Number(body.id), stock = Number(body.stock)
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(stock) || stock < 0 || stock > 2147483647) {
    ctx.body = fail('商品或库存参数不正确'); return
  }
  try { await merchantService.updateStock(ctx.state.merchant!.id, id, stock); ctx.body = success({ id, stock }) }
  catch (error) { const message = appErrorMessage(error); if (message) { ctx.body = fail(message); return }; throw error }
}

export const updateSaleStatus: AppMiddleware<SaleStatusUpdateInput> = async ctx => {
  const body = getBody(ctx.request.body), id = Number(body.id)
  const saleStatus = body.sale_status
  if (!Number.isInteger(id) || id <= 0 || (saleStatus !== 'on_sale' && saleStatus !== 'off_sale')) {
    ctx.body = fail('商品或上下架状态不正确'); return
  }
  try {
    await merchantService.updateSaleStatus(ctx.state.merchant!.id, id, saleStatus)
    ctx.body = success({ id, sale_status: saleStatus })
  } catch (error) { const message = appErrorMessage(error); if (message) { ctx.body = fail(message); return }; throw error }
}
