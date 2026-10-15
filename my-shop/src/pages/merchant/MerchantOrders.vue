<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import type { MerchantOrder, OrderStatus } from '../../../../shared/api'
import { getMerchantOrders, shipMerchantOrder } from '../../api'
import { formatOrderTime, getOrderStatusText } from '../../utils/order'

const route = useRoute()
const orders = ref<MerchantOrder[]>([])
const status = ref<OrderStatus | ''>('paid')
const loading = ref(false)
const errorMessage = ref('')
const carrier = ref<Record<number, string>>({})
const tracking = ref<Record<number, string>>({})
const shippingId = ref<number | null>(null)

async function load(): Promise<void> {
  loading.value = true; errorMessage.value = ''
  try { orders.value = await getMerchantOrders(Number(route.params.merchantId), status.value || undefined) }
  catch (error) { errorMessage.value = error instanceof Error ? error.message : '订单加载失败' }
  finally { loading.value = false }
}

async function ship(order: MerchantOrder): Promise<void> {
  const shippingCarrier = (carrier.value[order.id] ?? '').trim()
  const trackingNo = (tracking.value[order.id] ?? '').trim()
  if (shippingCarrier.length < 2 || !/^[a-zA-Z0-9-]{4,100}$/.test(trackingNo)) {
    errorMessage.value = '请填写物流公司和正确的运单号'; return
  }
  shippingId.value = order.id; errorMessage.value = ''
  try {
    await shipMerchantOrder(Number(route.params.merchantId), {
      order_id: order.id, shipping_carrier: shippingCarrier, tracking_no: trackingNo
    })
    await load()
  } catch (error) { errorMessage.value = error instanceof Error ? error.message : '发货失败' }
  finally { shippingId.value = null }
}

onMounted(load)
</script>

<template>
  <div class="page">
    <header><div><p>ORDER FULFILLMENT</p><h1>订单履约</h1><span>这里只展示当前店铺的商品明细</span></div><select v-model="status" @change="load"><option value="">全部订单</option><option value="paid">待发货</option><option value="shipped">已发货</option><option value="completed">已完成</option><option value="refunded">已退款</option><option value="cancelled">已取消</option></select></header>
    <p v-if="errorMessage" class="notice">{{ errorMessage }}</p>
    <div v-if="loading" class="state">订单加载中……</div>
    <div v-else-if="!orders.length" class="state">当前没有订单</div>
    <section v-else class="orders">
      <article v-for="order in orders" :key="order.id" class="card">
        <div class="head"><div><strong>{{ order.order_no }}</strong><small>{{ formatOrderTime(order.created_at) }}</small></div><b>{{ getOrderStatusText(order.status) }}</b></div>
        <div class="address">{{ order.receiver_name }} · {{ order.receiver_phone }} · {{ order.receiver_address }}</div>
        <div v-for="item in order.items" :key="item.id" class="item"><div><strong>{{ item.goods_name }}</strong><small>{{ item.goods_spec || '默认规格' }}</small></div><span>¥{{ item.unit_price.toFixed(2) }} × {{ item.quantity }}</span><em>{{ item.fulfillment_status === 'shipped' ? `${item.shipping_carrier} ${item.tracking_no}` : '待发货' }}</em></div>
        <div v-if="order.status === 'paid' && order.items.some(item => item.fulfillment_status === 'pending')" class="ship"><input v-model="carrier[order.id]" placeholder="物流公司"><input v-model="tracking[order.id]" placeholder="运单号"><button :disabled="shippingId === order.id" @click="ship(order)">{{ shippingId === order.id ? '提交中…' : '确认发货' }}</button></div>
      </article>
    </section>
  </div>
</template>

<style scoped>
.page{max-width:1100px;margin:auto}.page>header{display:flex;align-items:end;justify-content:space-between;margin-bottom:22px}.page header p{margin:0 0 6px;color:#819087;font-size:10px;font-weight:700;letter-spacing:.2em}.page h1{margin:0;font-size:30px}.page header span{display:block;margin-top:7px;color:#7c8981;font-size:13px}select,input{padding:10px 12px;border:1px solid #d7e0da;border-radius:9px;background:white}.orders{display:grid;gap:15px}.card{padding:20px;border:1px solid #e0e6e2;border-radius:15px;background:white}.head{display:flex;justify-content:space-between}.head small{display:block;margin-top:6px;color:#89958e}.head b{color:#a75c3e}.address{margin:15px 0;padding:11px;border-radius:8px;color:#65746b;background:#f5f7f5;font-size:13px}.item{display:grid;padding:11px 0;grid-template-columns:1fr auto 190px;gap:16px;border-top:1px solid #edf0ee;align-items:center}.item small{display:block;margin-top:4px;color:#8b9690}.item em{color:#66766d;font-size:12px;font-style:normal}.ship{display:flex;margin-top:14px;justify-content:flex-end;gap:8px}.ship button{padding:10px 16px;border:0;border-radius:9px;color:white;background:#2d6a4f;cursor:pointer}.notice{padding:11px;border-radius:8px;color:#a44735;background:#fff0eb}.state{display:grid;min-height:260px;place-items:center;color:#839087;background:white;border-radius:15px}@media(max-width:700px){.page>header{align-items:flex-start;gap:15px}.item{grid-template-columns:1fr auto}.item em{grid-column:1/-1}.ship{flex-direction:column}}
</style>
