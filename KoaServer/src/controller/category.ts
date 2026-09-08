import type { Category, InsertResult, IdInput } from '../../../shared/api'
import type { AppMiddleware } from '../types'
import { getBody } from '../utils/input'
//存放客户端列表查询请求的路由映射函数

import * as categoryService from '../service/category'
import { success, fail } from '../utils/response'

//GET /admin/category/list，返回所有分类数据，供前端构建树形结构使用
export const list: AppMiddleware<Category[]> = async ctx => {
  const categories = await categoryService.findAll()

  ctx.body = success(categories)
}

// GET /admin/category/?id=1，根据查询参数id返回指定分类数据，供前端编辑分类使用
export const detail: AppMiddleware<Category> = async ctx => {
  // 取出上下文对象ctx中的id，查询字符串中的值默认是字符串
  const id = Number(ctx.query.id)

  //Number.isInteger(id) 判断是否是整数，id必须是大于0的整数，||逻辑或
  if (!Number.isInteger(id) || id <= 0) {
    ctx.body = fail('分类ID不正确')
    return
  }

  const category = await categoryService.findById(id)

  if (!category) {
    ctx.body = fail('分类不存在')
    return
  }

  ctx.body = success(category)
}

// POST /admin/category/add 新增分类
export const add: AppMiddleware<InsertResult> = async ctx => {
  const body = getBody(ctx.request.body)

  // 先标准化输入，对用户输入的数据进行清洗
  //先进行类型检查，trim()去掉首尾空格，pid如果没有传则默认是0
  const name = typeof body.name === 'string'
    ? body.name.trim()
    : ''

  const picture = typeof body.picture === 'string'
    ? body.picture.trim()
    : ''

  const pid = Number(body.pid ?? 0) //??是ES2020新增的空值合并运算符，如果body.pid是undefined或null，则返回0，否则返回body.pid的值

  // 校验名称，如果没有传name或者name为空字符串，则返回错误信息
  if (!name) {
    ctx.body = fail('分类名称不能为空')
    return
  }

  if (name.length > 30) {
    ctx.body = fail('分类名称不能超过30个字符')
    return
  }

  // 校验图片路径长度
  if (picture.length > 255) {
    ctx.body = fail('分类图片地址过长')
    return
  }

  // pid只能是0或正整数
  if (!Number.isInteger(pid) || pid < 0) {
    ctx.body = fail('上级分类ID不正确')
    return
  }

  if (pid !== 0 && picture) {
    ctx.body = fail('二级分类不能设置分类图片')
    return
  }

  // pid不为0时，必须指向一个存在的一级分类
  if (pid !== 0) {
    const parent = await categoryService.findRootById(pid)

    if (!parent) {
      ctx.body = fail('上级分类不存在或不是一级分类')
      return
    }
  }

  const insertId = await categoryService.create({
    name,
    picture,
    pid
  })

  ctx.body = success({ insertId })
}

// POST /admin/category/save 修改分类
export const save: AppMiddleware<Category> = async ctx => {
  //避免后续代码访问时抛出 TypeError: Cannot read properties of undefined
  const body = getBody(ctx.request.body)   //通过提供默认空对象，保证始终有一个可操作的对象，使代码更健壮

  const id = Number(body.id)

  const name = typeof body.name === 'string'
    ? body.name.trim()
    : ''

  const picture = typeof body.picture === 'string'
    ? body.picture.trim()
    : ''

  const pid = Number(body.pid ?? 0)

  // 基础参数校验
  if (!Number.isInteger(id) || id <= 0) {
    ctx.body = fail('分类ID不正确')
    return
  }

  if (!name) {
    ctx.body = fail('分类名称不能为空')
    return
  }

  if (name.length > 30) {
    ctx.body = fail('分类名称不能超过30个字符')
    return
  }

  if (picture.length > 255) {
    ctx.body = fail('分类图片地址过长')
    return
  }

  if (!Number.isInteger(pid) || pid < 0) {
    ctx.body = fail('上级分类ID不正确')
    return
  }

  if (pid !== 0 && picture) {
    ctx.body = fail('二级分类不能设置分类图片')
    return
  }

  // 确认被修改的分类存在
  const category = await categoryService.findById(id)

  if (!category) {
    ctx.body = fail('修改失败，分类不存在')
    return
  }

  // 分类不能成为自己的父分类
  if (pid === id) {
    ctx.body = fail('分类不能将自己设为上级分类')
    return
  }

  // 二级分类的父级必须是一级分类
  if (pid !== 0) {
    const parent = await categoryService.findRootById(pid)

    if (!parent) {
      ctx.body = fail('上级分类不存在或不是一级分类')
      return
    }
  }

  /*
   * 如果当前分类还有子分类，就不能将它改成二级分类。
   *
   * 否则会形成：
   * 一级分类
   * └─ 当前分类
   *    └─ 原来的子分类
   *
   * 变成三级结构。
   */
  if (pid !== 0) {
    const childCount =
      await categoryService.countChildren(id)

    if (childCount > 0) {
      ctx.body = fail(
        '当前分类存在子分类，不能改为二级分类'
      )
      return
    }
  }

  const affectedRows = await categoryService.update({
    id,
    name,
    picture,
    pid
  })

  if (affectedRows === 0) {
    ctx.body = fail('分类修改失败')
    return
  }

  ctx.body = success({
    id,
    name,
    picture,
    pid
  })
}

// POST /admin/category/del 删除分类
export const remove: AppMiddleware<IdInput> = async ctx => {
  const id = Number(
    (getBody(ctx.request.body)).id
  )

  if (!Number.isInteger(id) || id <= 0) {
    ctx.body = fail('分类ID不正确')
    return
  }

  // 确认分类存在
  const category = await categoryService.findById(id)

  if (!category) {
    ctx.body = fail('删除失败，分类不存在')
    return
  }

  // 存在子分类时不能删除
  const childCount =
    await categoryService.countChildren(id)

  if (childCount > 0) {
    ctx.body = fail(
      '该分类存在子分类，请先删除子分类'
    )
    return
  }

  // 被商品引用时不能删除
  const goodsCount =
    await categoryService.countGoods(id)

  if (goodsCount > 0) {
    ctx.body = fail(
      '该分类下存在商品，请先处理相关商品'
    )
    return
  }

  const affectedRows =
    await categoryService.removeById(id)

  if (affectedRows === 0) {
    ctx.body = fail('分类删除失败')
    return
  }

  ctx.body = success({ id })
}
