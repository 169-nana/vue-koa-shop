import type { AdminAccount, InsertResult, LoginResult, MerchantOrder, OrderStatus, PublicAdmin, ShipMerchantOrderInput, UpdateAdminAccountInput } from '../../../shared/api'
import { requireAdmin } from '../utils/identity'
import type { AppMiddleware } from '../types'
import { getBody, hasErrorCode } from '../utils/input'
//存放管理员模块路由的映射处理器函数

//引入响应数据的工具函数
import { success, fail } from '../utils/response'

//登陆成功时生成token
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

import config from '../config/index'
import * as adminService from '../service/admin'
import * as merchantService from '../service/merchant'

//POST /admin/login 登录处理  发送token给客户端，客户端存储在localStorage中，后续请求携带token
export const login: AppMiddleware<LoginResult> = async ctx => {
  const { username, password } = getBody(ctx.request.body)

  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    ctx.body = fail('用户名和密码不能为空')
    return
  }

  //1. 根据用户名查询数据库
   const admin = await adminService.findByUsername(username)

  //2.比较明文密码和数据库哈希
   const passwordCorrect = admin ? await bcrypt.compare(password, admin.password) : false

  // 不分别提示“用户不存在”和“密码错误”
  if (!admin || !passwordCorrect) {
    ctx.body = fail('用户名或密码错误')
    return
  }

  if (admin.status !== 1) {
    ctx.body = fail('后台账号已被禁用')
    return
  }

  //jsonwebtoken​ 库生成一个JWT jwt.sign(payload, secret, options)
  const token = jwt.sign({
    // JWT中只保存定位管理员所需的数据
    id: admin.id,
    type: 'admin',
    role: admin.role
  },
  config.jwtSecret,     // secret（密钥）
  {
    expiresIn: config.jwtExpiresIn,     // options（选项）
  })
  
  ctx.body = success({ token })
}

//GET /admin/admin (需要鉴权)  获取管理员信息
export const getAdmin: AppMiddleware<PublicAdmin> = async ctx => {
const admin = await adminService.findById(
    requireAdmin(ctx).id
  )

  if (!admin) {
    ctx.body = fail('管理员不存在或已被删除', 2)
    return
  }

  ctx.body = success(admin)
}

// POST /admin/admin/changePassword  修改管理员密码
export const changePassword: AppMiddleware<null> = async ctx => {
  const { currentPassword, password } = getBody(ctx.request.body)

  if (typeof currentPassword !== 'string' || !currentPassword || currentPassword.length > 72) {
    ctx.body = fail('请输入有效的当前密码')
    return
  }

  if (typeof password !== 'string') {
    ctx.body = fail('密码格式不正确')
    return
  }

  /*
   * 密码不要使用 trim()。
   *
   * " abc123" 和 "abc123" 应该视为两个不同密码，
   * 服务端不应该静默修改用户输入。
   */
  if (
    password.length < 6 ||
    password.length > 12
  ) {
    ctx.body = fail(
      '密码长度必须在6到12个字符之间'
    )
    return
  }

  const admin = await adminService.findPasswordById(requireAdmin(ctx).id)
  if (!admin) {
    ctx.body = fail('管理员不存在或已被删除', 2)
    return
  }
  if (!await bcrypt.compare(currentPassword, admin.password)) {
    ctx.body = fail('当前密码不正确')
    return
  }
  if (password === currentPassword) {
    ctx.body = fail('新密码不能与当前密码相同')
    return
  }

  const passwordHash =
    await bcrypt.hash(password, 12)

  const affectedRows =
    await adminService.updatePassword(
      //防止水平越权攻击，使用JWT中保存的管理员id，防止管理员修改其他管理员的密码
      requireAdmin(ctx).id,
      passwordHash,
      admin.password
    )

  if (affectedRows === 0) {
    ctx.body = fail(
      '账号信息已变化，请重新登录后再试',
      2
    )
    return
  }

  ctx.body = success()
}

// POST /admin/admin/changeAvatar
export const changeAvatar: AppMiddleware<{ avatar: string }> = async ctx => {
  const { avatar } = getBody(ctx.request.body)

  if (typeof avatar !== 'string') {
    ctx.body = fail('头像地址格式不正确')
    return
  }

  const avatarPath = avatar.trim()

  if (!avatarPath || avatarPath.length > 255) {
    ctx.body = fail('头像地址不正确')
    return
  }

  /*
   * 只允许项目内部的相对资源路径，
   * 禁止绝对URL、反斜杠和路径穿越。
   */
  if (
    !/^(uploads|static\/image)\//.test(
      avatarPath
    ) ||
    avatarPath.includes('..') ||
    avatarPath.includes('\\')
  ) {
    ctx.body = fail('头像地址不合法')
    return
  }

  const affectedRows =
    await adminService.updateAvatar(
      requireAdmin(ctx).id,
      avatarPath
    )

  if (affectedRows === 0) {
    ctx.body = fail(
      '管理员不存在或已被删除',
      2
    )
    return
  }

  ctx.body = success({
    avatar: avatarPath
  })
}

export const listAccounts: AppMiddleware<AdminAccount[]> = async ctx => {
  ctx.body = success(await adminService.listAccounts())
}

export const createAccount: AppMiddleware<InsertResult> = async ctx => {
  const body = getBody(ctx.request.body)
  const username = typeof body.username === 'string' ? body.username.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const role = body.role
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) { ctx.body = fail('用户名必须是3到20位字母、数字或下划线'); return }
  if (password.length < 6 || password.length > 20) { ctx.body = fail('密码长度必须是6到20个字符'); return }
  if (role !== 'admin' && role !== 'reviewer') { ctx.body = fail('后台角色不正确'); return }
  try {
    const insertId = await adminService.createAccount(username, await bcrypt.hash(password, 12), role)
    ctx.body = success({ insertId })
  } catch (error) {
    if (hasErrorCode(error, 'ER_DUP_ENTRY')) { ctx.body = fail('后台用户名已经存在'); return }
    throw error
  }
}

export const updateAccount: AppMiddleware<UpdateAdminAccountInput> = async ctx => {
  const body = getBody(ctx.request.body), id = Number(body.id), role = body.role, status = Number(body.status)
  if (!Number.isInteger(id) || id <= 0 || (role !== 'admin' && role !== 'reviewer') || (status !== 0 && status !== 1)) {
    ctx.body = fail('账号参数不正确'); return
  }
  if (id === requireAdmin(ctx).id) { ctx.body = fail('不能修改当前登录账号的角色或状态'); return }
  if (!await adminService.updateAccount(id, role, status as 0 | 1)) { ctx.body = fail('后台账号不存在'); return }
  ctx.body = success({ id, role, status: status as 0 | 1 })
}

export const platformOrders: AppMiddleware<MerchantOrder[]> = async ctx => {
  const raw = ctx.query.status
  const statuses: OrderStatus[] = ['pending', 'paid', 'cancelled', 'shipped', 'completed', 'refunded']
  const status = typeof raw === 'string' ? statuses.find(item => item === raw) : undefined
  if (raw !== undefined && !status) { ctx.body = fail('订单状态不正确'); return }
  ctx.body = success(await merchantService.listOrders(null, status))
}

export const shipPlatformOrder: AppMiddleware<null> = async ctx => {
  const body = getBody(ctx.request.body)
  const orderId = Number(body.order_id)
  const shippingCarrier = typeof body.shipping_carrier === 'string' ? body.shipping_carrier.trim() : ''
  const trackingNo = typeof body.tracking_no === 'string' ? body.tracking_no.trim() : ''
  if (!Number.isInteger(orderId) || orderId <= 0 || shippingCarrier.length < 2 || shippingCarrier.length > 100 || !/^[a-zA-Z0-9-]{4,100}$/.test(trackingNo)) {
    ctx.body = fail('发货参数不正确'); return
  }
  const input: ShipMerchantOrderInput = { order_id: orderId, shipping_carrier: shippingCarrier, tracking_no: trackingNo }
  try { await merchantService.shipOrder(null, input); ctx.body = success() }
  catch (error) { if (error instanceof Error) { ctx.body = fail(error.message); return }; throw error }
}
