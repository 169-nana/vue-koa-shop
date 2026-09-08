import type { NotificationItem, PageResult, UnreadCount } from '../../../shared/api'
import type { AppMiddleware } from '../types'
import { getBody } from '../utils/input'
import { requireUser } from '../utils/identity'
import { fail, success } from '../utils/response'
import * as notificationService from '../service/notification'

export const list: AppMiddleware<PageResult<NotificationItem>> = async ctx => {
  const page = Number(ctx.query.page ?? 1), pagesize = Number(ctx.query.pagesize ?? 20)
  if (!Number.isInteger(page) || page <= 0 || !Number.isInteger(pagesize) || pagesize <= 0 || pagesize > 100) {
    ctx.body = fail('分页参数不正确'); return
  }
  const unreadOnly = ctx.query.unread_only === 'true' || ctx.query.unread_only === '1'
  ctx.body = success(await notificationService.list(requireUser(ctx).id, page, pagesize, unreadOnly))
}

export const unreadCount: AppMiddleware<UnreadCount> = async ctx => {
  ctx.body = success({ count: await notificationService.unreadCount(requireUser(ctx).id) })
}

export const markRead: AppMiddleware<null> = async ctx => {
  const id = Number(getBody(ctx.request.body).id)
  if (!Number.isInteger(id) || id <= 0) { ctx.body = fail('消息ID不正确'); return }
  if (!await notificationService.markRead(requireUser(ctx).id, id)) { ctx.body = fail('消息不存在'); return }
  ctx.body = success()
}

export const markAllRead: AppMiddleware<null> = async ctx => {
  await notificationService.markAllRead(requireUser(ctx).id)
  ctx.body = success()
}
