import type { AddressInput, InsertResult, UserAddress } from '../../../shared/api'
import type { AppMiddleware } from '../types'
import * as addressService from '../service/address'
import { requireUser } from '../utils/identity'
import { AppError, getBody } from '../utils/input'
import { fail, success } from '../utils/response'

function readAddress(value: unknown): { data: AddressInput } | { error: string } {
  const body = getBody(value)
  const receiverName = typeof body.receiver_name === 'string' ? body.receiver_name.trim() : ''
  const receiverPhone = typeof body.receiver_phone === 'string' ? body.receiver_phone.trim() : ''
  const receiverAddress = typeof body.receiver_address === 'string' ? body.receiver_address.trim() : ''
  if (!receiverName || receiverName.length > 50) return { error: '收货人姓名必须是1到50个字符' }
  if (!/^1\d{10}$/.test(receiverPhone)) return { error: '请输入正确的11位手机号码' }
  if (receiverAddress.length < 5 || receiverAddress.length > 255) return { error: '收货地址必须是5到255个字符' }
  return {
    data: {
      receiver_name: receiverName,
      receiver_phone: receiverPhone,
      receiver_address: receiverAddress,
      is_default: body.is_default === true
    }
  }
}

function readId(value: unknown): number | null {
  const id = Number(getBody(value).id)
  return Number.isInteger(id) && id > 0 ? id : null
}

async function handleBusiness(action: () => Promise<void>, ctx: Parameters<AppMiddleware<null>>[0]) {
  try {
    await action()
    ctx.body = success()
  } catch (error: unknown) {
    if (error instanceof AppError) {
      ctx.body = fail(error.message)
      return
    }
    throw error
  }
}

export const list: AppMiddleware<UserAddress[]> = async ctx => {
  const user = requireUser(ctx)
  ctx.body = success(await addressService.findByUserId(user.id))
}

export const add: AppMiddleware<InsertResult> = async ctx => {
  const user = requireUser(ctx)
  const result = readAddress(ctx.request.body)
  if ('error' in result) {
    ctx.body = fail(result.error)
    return
  }
  ctx.body = success({ insertId: await addressService.create(user.id, result.data) })
}

export const update: AppMiddleware<null> = async ctx => {
  const user = requireUser(ctx)
  const id = readId(ctx.request.body)
  const result = readAddress(ctx.request.body)
  if (id === null) { ctx.body = fail('收货地址ID不正确'); return }
  if ('error' in result) { ctx.body = fail(result.error); return }
  await handleBusiness(() => addressService.update(user.id, id, result.data), ctx)
}

export const setDefault: AppMiddleware<null> = async ctx => {
  const user = requireUser(ctx)
  const id = readId(ctx.request.body)
  if (id === null) { ctx.body = fail('收货地址ID不正确'); return }
  await handleBusiness(() => addressService.setDefault(user.id, id), ctx)
}

export const remove: AppMiddleware<null> = async ctx => {
  const user = requireUser(ctx)
  const id = readId(ctx.request.body)
  if (id === null) { ctx.body = fail('收货地址ID不正确'); return }
  await handleBusiness(() => addressService.remove(user.id, id), ctx)
}
