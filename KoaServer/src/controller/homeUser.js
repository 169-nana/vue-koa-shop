const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const config = require('../config')

const userService = require('../service/user')
const {
  success,
  fail
} = require('../utils/response')

// POST /home/register  用户注册功能
exports.register = async ctx => {
  const body = ctx.request.body || {}

//接收前端发来的数据第一步都要做数据处理和验证
  const username =
    typeof body.username === 'string'
      ? body.username.trim()
      : ''

  /*
   * 密码不能trim。
   * 服务端不应该偷偷改变用户设置的密码。
   */
  const password =
    typeof body.password === 'string'
      ? body.password
      : ''

  if (
    !/^[a-zA-Z0-9_]{3,20}$/.test(
      username
    )
  ) {
    ctx.body = fail(
      '用户名必须是3到20位字母、数字或下划线'
    )
    return
  }

  if (
    password.length < 6 ||
    password.length > 20
  ) {
    ctx.body = fail(
      '密码长度必须在6到20个字符之间'
    )
    return
  }

  const existingUser =
    await userService.findByUsername(username)

  if (existingUser) {
    ctx.body = fail('用户名已经存在')
    return
  }

  const passwordHash =
    await bcrypt.hash(password, 12)

  try {
    const insertId = await userService.create({
      username,
      passwordHash
    })

    ctx.body = success({
      id: insertId,
      username
    })
  } catch (error) {
    /*
     * username字段有UNIQUE约束。
     * 两个相同注册请求同时到达时，
     * 数据库是最后一道防线。
     */
    if (error.code === 'ER_DUP_ENTRY') {
      ctx.body = fail('用户名已经存在')
      return
    }

    throw error
  }
}

// POST /home/login  用户登录功能
exports.login = async ctx => {
  const body = ctx.request.body || {}

  const username =
    typeof body.username === 'string'
      ? body.username.trim()
      : ''

  const password =
    typeof body.password === 'string'
      ? body.password
      : ''

  if (!username || !password) {
    ctx.body = fail(
      '用户名和密码不能为空'
    )
    return
  }

  const user =
    await userService.findByUsername(username)

  const passwordCorrect = user
    ? await bcrypt.compare(
        password,
        user.password
      )
    : false

  /*
   * 用户不存在和密码错误使用相同提示，
   * 避免外部人员探测哪些用户名已注册。
   */
  if (!user || !passwordCorrect) {
    ctx.body = fail('用户名或密码错误')
    return
  }

  if (user.status !== 1) {
    ctx.body = fail('账号已被禁用')
    return
  }

  const token = jwt.sign(
    {
      id: user.id,
      type: 'user'
    },
    config.jwtSecret,
    {
      expiresIn: config.jwtExpiresIn
    }
  )

  ctx.body = success({ token })
}

// GET /home/user   获取当前登录用户信息
exports.getUser = async ctx => {
  const {
    status,
    ...publicUser
  } = ctx.state.user

  ctx.body = success(publicUser)
}