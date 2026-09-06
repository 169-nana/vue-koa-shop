import type { LoginResult, PublicAdmin } from '../../../shared/api'
import { requireAdmin } from '../utils/identity'
import type { AppMiddleware } from '../types'
import { getBody } from '../utils/input'
//存放管理员模块路由的映射处理器函数

//引入响应数据的工具函数
import { success, fail } from '../utils/response'

//登陆成功时生成token
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

import config from '../config/index'
import * as adminService from '../service/admin'

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

  //jsonwebtoken​ 库生成一个JWT jwt.sign(payload, secret, options)
  const token = jwt.sign({
    // JWT中只保存定位管理员所需的数据
    id: admin.id,
    type: 'admin'
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
  const { password } = getBody(ctx.request.body)

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

  const passwordHash =
    await bcrypt.hash(password, 12)

  const affectedRows =
    await adminService.updatePassword(
      //防止水平越权攻击，使用JWT中保存的管理员id，防止管理员修改其他管理员的密码
      requireAdmin(ctx).id,
      passwordHash
    )

  if (affectedRows === 0) {
    ctx.body = fail(
      '管理员不存在或已被删除',
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
