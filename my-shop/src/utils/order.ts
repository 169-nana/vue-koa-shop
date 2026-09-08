import type { OrderStatus } from '../../../shared/api'

const labels: Record<OrderStatus, string> = {
  pending: '待支付',
  paid: '待发货',
  cancelled: '已取消',
  shipped: '已发货',
  completed: '已完成'
}

export const getOrderStatusText = (status: OrderStatus) => labels[status]

export const formatOrderTime = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN')
}
