<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import type { OrderDetail } from '../../../shared/api'
import { cancelOrder, createRefund, getOrderDetail } from '../api'
import { toAssetURL } from '../config'
import { formatOrderTime, getOrderStatusText } from '../utils/order'

const route = useRoute()
const order = ref<OrderDetail | null>(null)
const loading = ref(true)
const cancelling = ref(false)
const refundOpen = ref(false)
const refundReason = ref('')
const refunding = ref(false)
const refundSubmitted = ref(false)
const errorMessage = ref('')

async function loadOrder() {
  const id = Number(route.params.id)
  if (!Number.isInteger(id) || id <= 0) {
    errorMessage.value = '订单编号不正确'
    loading.value = false
    return
  }
  loading.value = true
  errorMessage.value = ''
  try {
    order.value = await getOrderDetail(id)
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : '订单加载失败'
  } finally {
    loading.value = false
  }
}

async function cancel() {
  if (!order.value || cancelling.value) return
  cancelling.value = true
  errorMessage.value = ''
  try {
    await cancelOrder(order.value.id)
    order.value.status = 'cancelled'
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : '取消订单失败'
  } finally {
    cancelling.value = false
  }
}

async function submitRefund() {
  if (!order.value || refunding.value) return
  const reason = refundReason.value.trim()
  if (reason.length < 5 || reason.length > 500) {
    errorMessage.value = '售后原因必须是5到500个字符'
    return
  }
  refunding.value = true
  errorMessage.value = ''
  try {
    await createRefund({ order_id: order.value.id, reason })
    refundSubmitted.value = true
    refundOpen.value = false
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : '售后申请提交失败'
  } finally {
    refunding.value = false
  }
}

onMounted(loadOrder)
</script>

<template>
  <main class="page-shell">
    <header><RouterLink class="brand" to="/">微商城</RouterLink><nav><RouterLink to="/orders">返回订单列表</RouterLink><RouterLink to="/cart">购物车</RouterLink></nav></header>
    <section v-if="loading" class="state">订单加载中……</section>
    <section v-else-if="errorMessage && !order" class="state error"><p>{{ errorMessage }}</p><RouterLink to="/orders">返回订单列表</RouterLink></section>
    <template v-else-if="order">
      <div class="title-row"><div><p>ORDER DETAIL</p><h1>订单详情</h1></div><strong class="status">{{ getOrderStatusText(order.status) }}</strong></div>
      <p v-if="errorMessage" class="inline-error">{{ errorMessage }}</p>
      <section class="card meta">
        <div><small>订单号</small><p>{{ order.order_no }}</p></div><div><small>下单时间</small><p>{{ formatOrderTime(order.created_at) }}</p></div><div><small>订单金额</small><p class="amount">¥{{ order.total_amount.toFixed(2) }}</p></div>
      </section>
      <section class="card"><h2>收货信息</h2><dl><div><dt>收货人</dt><dd>{{ order.receiver_name }}</dd></div><div><dt>手机号码</dt><dd>{{ order.receiver_phone }}</dd></div><div><dt>收货地址</dt><dd>{{ order.receiver_address }}</dd></div></dl></section>
      <section class="card"><h2>商品明细</h2><article v-for="item in order.items" :key="item.id" class="item"><RouterLink :to="{ name: 'goods-detail', params: { id: item.goods_id } }"><img :src="toAssetURL(item.goods_picture)" :alt="item.goods_name"></RouterLink><div><strong>{{ item.goods_name }}</strong><p>{{ item.goods_spec || '默认规格' }}</p></div><span>¥{{ item.unit_price.toFixed(2) }} × {{ item.quantity }}</span><strong class="amount">¥{{ item.subtotal.toFixed(2) }}</strong></article></section>
      <div class="actions">
        <button v-if="order.status === 'pending'" :disabled="cancelling" @click="cancel">{{ cancelling ? '正在取消……' : '取消订单' }}</button>
        <button v-if="(order.status === 'paid' || order.status === 'shipped') && !refundSubmitted" @click="refundOpen = !refundOpen">申请售后 / 退款</button>
        <RouterLink v-if="refundSubmitted" to="/after-sales">申请已提交，查看进度 →</RouterLink>
      </div>
      <section v-if="refundOpen" class="card refund-card">
        <h2>申请售后 / 退款</h2>
        <p>请说明申请原因，提交后可以在个人中心查看处理进度。</p>
        <textarea v-model="refundReason" maxlength="500" rows="5" placeholder="例如：收到的商品有破损，希望申请退款" />
        <div><small>{{ refundReason.trim().length }}/500</small><button type="button" :disabled="refunding" @click="submitRefund">{{ refunding ? '正在提交……' : '提交申请' }}</button></div>
      </section>
    </template>
  </main>
</template>

<style scoped>
.page-shell { width: min(980px, calc(100% - 40px)); margin: 0 auto 50px; color: #26352d; }header { display: flex; min-height: 88px; align-items: center; justify-content: space-between; }.brand { color: #2d6a4f; font: 700 23px Georgia, "Microsoft YaHei", serif; }nav { display: flex; gap: 22px; color: #68766e; font-size: 14px; }
.title-row { display: flex; margin: 28px 0 24px; align-items: end; justify-content: space-between; }.title-row p { margin: 0 0 8px; color: #7a8e80; font-size: 11px; font-weight: 700; letter-spacing: .2em; }h1 { margin: 0; font: 700 38px Georgia, "Microsoft YaHei", serif; }.status { padding: 8px 15px; border-radius: 999px; color: #9b5b3e; background: #fff0e7; }
.state { display: grid; min-height: 380px; place-items: center; align-content: center; border-radius: 20px; background: white; }.state a { padding: 10px 18px; border-radius: 999px; color: white; background: #2d6a4f; }.error, .inline-error { color: #b54d3a; }.inline-error { padding: 12px 16px; border-radius: 10px; background: #fff0eb; }
.card { margin-bottom: 20px; padding: 26px; border-radius: 18px; background: white; box-shadow: 0 8px 28px rgba(46, 64, 54, .06); }.card h2 { margin: 0 0 20px; font-size: 19px; }.meta { display: grid; gap: 22px; grid-template-columns: repeat(3, 1fr); }.meta small, dt { color: #8b958f; }.meta p { margin: 8px 0 0; }.amount { color: #cf5d42; }
dl { margin: 0; }dl div { display: grid; padding: 10px 0; grid-template-columns: 100px 1fr; }dd { margin: 0; }.item { display: grid; gap: 18px; padding: 16px 0; align-items: center; border-top: 1px solid #edf0ee; grid-template-columns: 70px 1fr auto auto; }.item img { width: 70px; height: 70px; border-radius: 10px; object-fit: cover; }.item p { margin: 7px 0 0; color: #8b958f; font-size: 13px; }.actions { text-align: right; }.actions button { padding: 11px 22px; border: 1px solid #b95e4b; border-radius: 999px; color: #a44938; background: white; cursor: pointer; }.actions button:disabled { opacity: .5; }
.actions { display: flex; gap: 12px; justify-content: flex-end; align-items: center; }.actions a { color: #2d6a4f; }.refund-card { margin-top: 18px; }.refund-card > p { color: #748078; }.refund-card textarea { width: 100%; padding: 13px; resize: vertical; border: 1px solid #d4ddd7; border-radius: 10px; font: inherit; }.refund-card > div { display: flex; margin-top: 12px; align-items: center; justify-content: space-between; }.refund-card small { color: #909b95; }.refund-card button { padding: 10px 20px; border: 0; border-radius: 999px; color: white; background: #2d6a4f; cursor: pointer; }
@media (max-width: 650px) { .meta { grid-template-columns: 1fr; }.item { grid-template-columns: 60px 1fr; }.item > span, .item > .amount { grid-column: 2; } }
</style>
