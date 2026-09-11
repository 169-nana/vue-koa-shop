import type {
  ChatCompletionMessageFunctionToolCall
} from 'openai/resources/chat/completions'

import type {
  Goods,
  OrderStatus,
  ShopAgentPendingAction
} from '../../../shared/api'

import {
  findPersonalizedGoods,
  searchPublicGoods
} from '../service/agentCatalog'
import { searchAgentKnowledge } from '../service/agentKnowledge'
import { prepareAddToCart } from '../service/agentCartAction'
import * as cartService from '../service/cart'
import * as goodsService from '../service/goods'
import * as orderService from '../service/order'

const ORDER_STATUSES: OrderStatus[] = [
  'pending', 'paid', 'cancelled', 'shipped', 'completed'
]

export interface ShopAgentToolResult {
  content: string
  products: Goods[]
  pendingAction?: ShopAgentPendingAction
}

function parseArguments(
  value: string
): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(value)

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return null
    }

    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

function errorResult(
  message: string
): ShopAgentToolResult {
  return {
    content: JSON.stringify({
      error: message
    }),
    products: []
  }
}

function cleanText(value: string | null | undefined): string | undefined {
  if (!value) return undefined

  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500) || undefined
}

function toModelProduct(product: Goods) {
  return {
    id: product.id,
    name: cleanText(product.name) ?? '',
    price: product.price,
    stock: product.stock,
    spec: cleanText(product.spec),
    description: cleanText(product.description)
  }
}

export async function executeShopAgentTool(
  call: ChatCompletionMessageFunctionToolCall,
  userId?: number
): Promise<ShopAgentToolResult> {
  const args =
    parseArguments(call.function.arguments)

  if (!args) {
    return errorResult('工具参数不是有效的JSON')
  }

  if (call.function.name === 'search_shop_knowledge') {
    const query = args.query
    if (typeof query !== 'string' || !query.trim() || query.trim().length > 100) {
      return errorResult('知识库查询内容不正确')
    }
    const knowledge = await searchAgentKnowledge(query.trim())
    return {
      content: JSON.stringify({ knowledge }),
      products: []
    }
  }

  if (call.function.name === 'get_personalized_recommendations') {
    if (userId === undefined) return errorResult('请先登录商城账号后再使用个性化推荐')
    const limit = args.limit === undefined ? 5 : args.limit
    if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > 8) {
      return errorResult('推荐数量必须在1到8之间')
    }
    const result = await findPersonalizedGoods(userId, limit)
    return {
      content: JSON.stringify({
        personalized: result.personalized,
        products: result.products.map(toModelProduct)
      }),
      products: result.products
    }
  }

  if (call.function.name === 'compare_products') {
    const productIds = args.product_ids
    if (
      !Array.isArray(productIds) ||
      productIds.length < 2 ||
      productIds.length > 4 ||
      productIds.some(id => typeof id !== 'number' || !Number.isInteger(id) || id <= 0)
    ) {
      return errorResult('商品对比需要2到4个有效商品ID')
    }
    const uniqueIds = [...new Set(productIds)]
    if (uniqueIds.length !== productIds.length) return errorResult('商品对比ID不能重复')
    const found = await Promise.all(uniqueIds.map(id => goodsService.findPublicById(id)))
    const products = found.filter((product): product is NonNullable<typeof product> => product !== null)
    return {
      content: JSON.stringify({
        products: products.map(toModelProduct),
        unavailable_ids: uniqueIds.filter(id => !products.some(product => product.id === id))
      }),
      products
    }
  }

  if (call.function.name === 'get_my_cart') {
    if (userId === undefined) return errorResult('请先登录商城账号后再查询购物车')
    const items = await cartService.findByUserId(userId)
    return {
      content: JSON.stringify({
        items: items.slice(0, 30).map(item => ({
          cart_id: item.id,
          product_id: item.goods_id,
          name: cleanText(item.name) ?? '',
          price: item.price,
          stock: item.stock,
          quantity: item.quantity,
          selected_spec: cleanText(item.selected_spec)
        }))
      }),
      products: []
    }
  }

  if (call.function.name === 'prepare_add_to_cart') {
    if (userId === undefined) return errorResult('请先登录商城账号后再加入购物车')
    const productId = args.product_id
    const quantity = args.quantity
    const selectedSpec = args.selected_spec
    if (typeof productId !== 'number' || !Number.isInteger(productId) || productId <= 0) {
      return errorResult('商品ID不正确')
    }
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      return errorResult('加购数量必须是1到99之间的整数')
    }
    if (selectedSpec !== undefined && (typeof selectedSpec !== 'string' || selectedSpec.trim().length > 255)) {
      return errorResult('商品规格不正确')
    }
    try {
      const pendingAction = await prepareAddToCart(
        userId,
        productId,
        quantity,
        typeof selectedSpec === 'string' ? selectedSpec : undefined
      )
      return {
        content: JSON.stringify({
          confirmation_required: true,
          title: pendingAction.title,
          description: pendingAction.description,
          expires_at: pendingAction.expires_at
        }),
        products: [],
        pendingAction
      }
    } catch (error: unknown) {
      return errorResult(error instanceof Error ? error.message : '无法准备加购操作')
    }
  }

  if (call.function.name === 'get_product_detail') {
    const productId = args.product_id
    if (typeof productId !== 'number' || !Number.isInteger(productId) || productId <= 0) {
      return errorResult('商品ID不正确')
    }
    const product = await goodsService.findPublicById(productId)
    return product
      ? {
          content: JSON.stringify({
            product: toModelProduct(product)
          }),
          products: [product]
        }
      : errorResult('商品不存在或当前不可售')
  }

  if (call.function.name === 'get_my_orders') {
    if (userId === undefined) return errorResult('请先登录商城账号后再查询订单')
    const status = typeof args.status === 'string'
      ? ORDER_STATUSES.find(item => item === args.status)
      : undefined
    if (args.status !== undefined && !status) return errorResult('订单状态不正确')
    const orders = await orderService.findByUserId(userId, status)
    return {
      content: JSON.stringify({
        orders: orders.slice(0, 20).map(order => ({
          id: order.id,
          order_no: order.order_no,
          status: order.status,
          total_amount: order.total_amount,
          created_at: order.created_at
        }))
      }),
      products: []
    }
  }

  if (call.function.name === 'get_my_order_detail') {
    if (userId === undefined) return errorResult('请先登录商城账号后再查询订单')
    const orderId = args.order_id
    if (typeof orderId !== 'number' || !Number.isInteger(orderId) || orderId <= 0) {
      return errorResult('订单ID不正确')
    }
    const order = await orderService.findDetail(userId, orderId)
    if (!order) return errorResult('订单不存在')
    return {
      content: JSON.stringify({
        order: {
          id: order.id,
          order_no: order.order_no,
          status: order.status,
          total_amount: order.total_amount,
          created_at: order.created_at,
          items: order.items.slice(0, 50).map(item => ({
            goods_id: item.goods_id,
            goods_name: cleanText(item.goods_name) ?? '',
            goods_spec: cleanText(item.goods_spec),
            unit_price: item.unit_price,
            quantity: item.quantity,
            subtotal: item.subtotal
          }))
        }
      }),
      products: []
    }
  }

  if (call.function.name !== 'search_products') return errorResult('未知工具')

  let keyword: string | undefined

  if (args.keyword !== undefined) {
    if (typeof args.keyword !== 'string') {
      return errorResult('商品关键词格式不正确')
    }

    keyword = args.keyword.trim()

    if (keyword.length > 60) {
      return errorResult('商品关键词不能超过60个字符')
    }

    if (!keyword) {
      keyword = undefined
    }
  }

  let categoryId: number | undefined

  if (args.category_id !== undefined) {
    if (
      typeof args.category_id !== 'number' ||
      !Number.isInteger(args.category_id) ||
      args.category_id <= 0
    ) {
      return errorResult('商品分类ID不正确')
    }

    categoryId = args.category_id
  }

  let minPrice: number | undefined
  let maxPrice: number | undefined

  if (args.min_price !== undefined) {
    if (
      typeof args.min_price !== 'number' ||
      !Number.isFinite(args.min_price) ||
      args.min_price < 0
    ) {
      return errorResult('最低价格不正确')
    }

    minPrice = args.min_price
  }

  if (args.max_price !== undefined) {
    if (
      typeof args.max_price !== 'number' ||
      !Number.isFinite(args.max_price) ||
      args.max_price < 0
    ) {
      return errorResult('最高价格不正确')
    }

    maxPrice = args.max_price
  }

  if (
    minPrice !== undefined &&
    maxPrice !== undefined &&
    minPrice > maxPrice
  ) {
    return errorResult('最低价格不能高于最高价格')
  }

  let limit = 5

  if (args.limit !== undefined) {
    if (
      typeof args.limit !== 'number' ||
      !Number.isInteger(args.limit) ||
      args.limit < 1 ||
      args.limit > 8
    ) {
      return errorResult('商品返回数量必须在1到8之间')
    }

    limit = args.limit
  }

  const products = await searchPublicGoods({
    keyword,
    categoryId,
    minPrice,
    maxPrice,
    limit
  })

  return {
    content: JSON.stringify({
      products: products.map(toModelProduct)
    }),
    products
  }
}
