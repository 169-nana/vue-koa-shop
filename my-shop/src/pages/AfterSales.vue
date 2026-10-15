<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { RefundApplication, RefundStatus } from '../../../shared/api'
import { getRefunds } from '../api'
import { formatOrderTime } from '../utils/order'

const applications = ref<RefundApplication[]>([])
const loading = ref(true)
const errorMessage = ref('')
const statusText: Record<RefundStatus, string> = { pending: '等待处理', approved: '已同意', rejected: '已拒绝' }

async function loadApplications() {
  loading.value = true
  errorMessage.value = ''
  try { applications.value = await getRefunds() }
  catch (error: unknown) { errorMessage.value = error instanceof Error ? error.message : '售后记录加载失败' }
  finally { loading.value = false }
}

onMounted(loadApplications)
</script>

<template>
  <main class="page-shell">
    <header><RouterLink class="brand" to="/">微商城</RouterLink><nav><RouterLink to="/orders">我的订单</RouterLink><RouterLink to="/profile">个人中心</RouterLink></nav></header>
    <div class="title"><p>AFTER-SALES SERVICE</p><h1>售后 / 退款</h1><span>在订单详情中可以为已支付或已发货订单提交申请</span></div>
    <section v-if="loading" class="state">售后记录加载中……</section>
    <section v-else-if="errorMessage" class="state error"><p>{{ errorMessage }}</p><button @click="loadApplications">重新加载</button></section>
    <section v-else-if="applications.length === 0" class="state"><h2>暂无售后申请</h2><p>如需售后，请先进入对应订单详情。</p><RouterLink to="/orders">查看我的订单</RouterLink></section>
    <section v-else class="application-list">
      <article v-for="item in applications" :key="item.id" class="application-card">
        <div class="card-head"><div><small>售后单关联订单</small><RouterLink :to="{ name: 'order-detail', params: { id: item.order_id } }">{{ item.order_no }} →</RouterLink></div><strong :class="`status-${item.status}`">{{ statusText[item.status] }}</strong></div>
        <p v-if="item.goods_name" class="goods">{{ item.goods_name }} · {{ item.request_type === 'return_refund' ? '退货退款' : '仅退款' }} · 数量 {{ item.quantity }}</p>
        <div class="detail-grid"><div><small>申请金额</small><b>¥{{ item.refund_amount.toFixed(2) }}</b></div><div><small>申请时间</small><span>{{ formatOrderTime(item.created_at) }}</span></div></div>
        <p v-if="item.review_note" class="review-note">处理说明：{{ item.review_note }}</p>
        <div class="reason"><small>申请原因</small><p>{{ item.reason }}</p></div>
      </article>
    </section>
  </main>
</template>

<style scoped>
.page-shell { width: min(900px, calc(100% - 40px)); margin: 0 auto 60px; color: #26352d; }header { display: flex; min-height: 88px; align-items: center; justify-content: space-between; }.brand { color: #2d6a4f; font: 700 23px Georgia,"Microsoft YaHei",serif; }nav { display: flex; gap: 20px; color: #68766e; font-size: 14px; }.title { margin: 30px 0 25px; }.title > p { margin: 0 0 8px; color: #829087; font-size: 10px; font-weight: 700; letter-spacing: .2em; }.title h1 { margin: 0 0 10px; font: 700 38px Georgia,"Microsoft YaHei",serif; }.title span { color: #87938c; font-size: 13px; }.state { display: grid; min-height: 350px; padding: 25px; place-items: center; align-content: center; border-radius: 22px; background: white; text-align: center; }.state p { color: #849088; }.state a,.state button { padding: 10px 19px; border: 0; border-radius: 999px; color: white; background: #2d6a4f; cursor: pointer; }.state.error { color: #ac4c3b; }.application-list { display: grid; gap: 17px; }.application-card { padding: 25px; border-radius: 20px; background: white; box-shadow: 0 8px 27px rgba(46,64,54,.06); }.card-head { display: flex; align-items: center; justify-content: space-between; }.card-head small,.reason small,.detail-grid small { display: block; margin-bottom: 7px; color: #919b95; }.card-head a { font-weight: 700; }.card-head strong { padding: 7px 13px; border-radius: 999px; color: #9d623e; background: #fff1e6; font-size: 13px; }.card-head .status-approved { color: #2f7555; background: #e9f5ee; }.card-head .status-rejected { color: #8a5650; background: #f3eeee; }.goods,.review-note { padding: 10px 12px; border-radius: 10px; color: #53675c; background: #f3f7f4; }.review-note { color: #315943; }.detail-grid { display: grid; gap: 20px; margin: 22px 0; padding: 18px 0; border-block: 1px solid #edf0ee; grid-template-columns: 1fr 1fr; }.detail-grid b { color: #d05c42; font-size: 22px; }.reason p { margin: 0; line-height: 1.7; }.error { color: #b54d3a; }@media(max-width:520px){.detail-grid{grid-template-columns:1fr}.card-head{align-items:flex-start}}
</style>
