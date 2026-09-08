<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { OrderStatus, OrderSummary } from '../../../shared/api'
import { getOrders } from '../api'
import { formatOrderTime, getOrderStatusText } from '../utils/order'

const orders = ref<OrderSummary[]>([])
const route = useRoute()
const loading = ref(true)
const errorMessage = ref('')

const tabs: { label: string; status?: OrderStatus }[] = [
  { label: '全部' },
  { label: '待支付', status: 'pending' },
  { label: '待发货', status: 'paid' },
  { label: '待收货', status: 'shipped' },
  { label: '已完成', status: 'completed' },
  { label: '已取消', status: 'cancelled' }
]
const statuses: OrderStatus[] = ['pending', 'paid', 'shipped', 'completed', 'cancelled']

function routeStatus(): OrderStatus | undefined {
  return typeof route.query.status === 'string'
    ? statuses.find(status => status === route.query.status)
    : undefined
}

async function loadOrders(status = routeStatus()) {
  loading.value = true
  errorMessage.value = ''
  try {
    orders.value = await getOrders(status)
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : '订单加载失败'
  } finally {
    loading.value = false
  }
}

watch(() => route.query.status, () => loadOrders(), { immediate: true })
</script>

<template>
  <main class="page-shell">
    <header><RouterLink class="brand" to="/">微商城</RouterLink><nav><RouterLink to="/cart">购物车</RouterLink><RouterLink to="/profile">个人中心</RouterLink></nav></header>
    <div class="title"><p>MY ORDERS</p><h1>我的订单</h1></div>
    <nav class="status-tabs" aria-label="订单状态筛选">
      <RouterLink v-for="tab in tabs" :key="tab.label" :to="tab.status ? { name: 'orders', query: { status: tab.status } } : { name: 'orders' }" :class="{ active: routeStatus() === tab.status }">{{ tab.label }}</RouterLink>
    </nav>
    <section v-if="loading" class="state">订单加载中……</section>
    <section v-else-if="errorMessage" class="state error"><p>{{ errorMessage }}</p><button @click="loadOrders()">重新加载</button></section>
    <section v-else-if="orders.length === 0" class="state"><h2>还没有订单</h2><RouterLink to="/">去挑选商品</RouterLink></section>
    <section v-else class="order-list">
      <RouterLink v-for="order in orders" :key="order.id" :to="{ name: 'order-detail', params: { id: order.id } }" class="order-card">
        <div class="order-head"><span>订单号 {{ order.order_no }}</span><strong :class="`status-${order.status}`">{{ getOrderStatusText(order.status) }}</strong></div>
        <div class="order-body"><div><small>下单时间</small><p>{{ formatOrderTime(order.created_at) }}</p></div><div><small>收货人</small><p>{{ order.receiver_name }}</p></div><div class="amount"><small>订单金额</small><p>¥{{ order.total_amount.toFixed(2) }}</p></div><span>查看详情 →</span></div>
      </RouterLink>
    </section>
  </main>
</template>

<style scoped>
.page-shell { width: min(980px, calc(100% - 40px)); margin: 0 auto 50px; color: #26352d; }
header { display: flex; min-height: 88px; align-items: center; justify-content: space-between; }
.brand { color: #2d6a4f; font: 700 23px Georgia, "Microsoft YaHei", serif; }
nav { display: flex; gap: 22px; color: #68766e; font-size: 14px; }
.title { margin: 28px 0 24px; }.title p { margin: 0 0 8px; color: #7a8e80; font-size: 11px; font-weight: 700; letter-spacing: .2em; }h1 { margin: 0; font: 700 38px Georgia, "Microsoft YaHei", serif; }
.status-tabs { display: flex; gap: 8px; margin: 0 0 22px; overflow-x: auto; }.status-tabs a { flex: 0 0 auto; padding: 9px 16px; border-radius: 999px; color: #718078; background: white; font-size: 13px; }.status-tabs a.active { color: white; background: #2d6a4f; }
.state { display: grid; min-height: 350px; place-items: center; align-content: center; border-radius: 20px; background: white; }
.state a, .state button { padding: 11px 20px; border: 0; border-radius: 999px; color: white; background: #2d6a4f; cursor: pointer; }.error { color: #b54d3a; }
.order-list { display: grid; gap: 18px; }.order-card { display: block; overflow: hidden; border-radius: 18px; background: white; box-shadow: 0 8px 28px rgba(46, 64, 54, .06); transition: .2s; }.order-card:hover { box-shadow: 0 14px 34px rgba(46, 64, 54, .12); transform: translateY(-2px); }
.order-head { display: flex; padding: 15px 22px; justify-content: space-between; border-bottom: 1px solid #edf0ee; color: #7d8982; font-size: 13px; }.order-head strong { color: #c06a45; }.order-head .status-cancelled { color: #929b96; }.order-head .status-completed { color: #2d6a4f; }
.order-body { display: grid; gap: 24px; padding: 22px; align-items: center; grid-template-columns: 1.3fr 1fr 1fr auto; }.order-body small { color: #949d98; }.order-body p { margin: 7px 0 0; }.amount p { color: #cf5d42; font-size: 20px; font-weight: 700; }.order-body > span { color: #2d6a4f; font-size: 13px; }
@media (max-width: 650px) { .order-body { grid-template-columns: 1fr 1fr; }.order-body > span { grid-column: 1 / -1; } }
</style>
