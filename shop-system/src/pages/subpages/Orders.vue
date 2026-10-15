<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { MerchantOrder, OrderStatus } from '../../../../shared/api'
import { getPlatformOrders, shipPlatformOrder } from '../../api'

const orders = ref<MerchantOrder[]>([])
const status = ref<OrderStatus | ''>('paid')
const loading = ref(false)
const carrier = ref<Record<number, string>>({})
const tracking = ref<Record<number, string>>({})
const statusText: Record<OrderStatus, string> = { pending: '待支付', paid: '待发货', cancelled: '已取消', shipped: '已发货', completed: '已完成', refunded: '已退款' }

async function load(): Promise<void> {
  loading.value = true
  try { orders.value = await getPlatformOrders(status.value || undefined) }
  catch (error) { ElMessage.error(error instanceof Error ? error.message : '订单加载失败') }
  finally { loading.value = false }
}
async function ship(orderId: number): Promise<void> {
  const shippingCarrier = (carrier.value[orderId] ?? '').trim()
  const trackingNo = (tracking.value[orderId] ?? '').trim()
  if (shippingCarrier.length < 2 || !/^[a-zA-Z0-9-]{4,100}$/.test(trackingNo)) { ElMessage.warning('请填写正确的物流公司和运单号'); return }
  try { await shipPlatformOrder({ order_id: orderId, shipping_carrier: shippingCarrier, tracking_no: trackingNo }); ElMessage.success('发货成功'); await load() }
  catch (error) { ElMessage.error(error instanceof Error ? error.message : '发货失败') }
}
onMounted(load)
</script>

<template>
  <section class="page"><div class="heading"><div><h2>平台订单履约</h2><p>处理平台自营商品；商家商品由各店铺自行发货</p></div><el-select v-model="status" style="width:140px" @change="load"><el-option label="全部" value="" /><el-option v-for="(label,key) in statusText" :key="key" :label="label" :value="key" /></el-select></div>
    <el-empty v-if="!loading && !orders.length" description="暂无订单" />
    <div v-loading="loading" class="list"><el-card v-for="order in orders" :key="order.id" shadow="never"><template #header><div class="card-head"><strong>{{ order.order_no }}</strong><el-tag>{{ statusText[order.status] }}</el-tag></div></template><p>{{ order.receiver_name }} · {{ order.receiver_phone }} · {{ order.receiver_address }}</p><div v-for="item in order.items" :key="item.id" class="item"><span>{{ item.goods_name }} / {{ item.goods_spec || '默认规格' }}</span><span>× {{ item.quantity }}</span><span>¥{{ item.subtotal.toFixed(2) }}</span></div><div v-if="order.status === 'paid'" class="ship"><el-input v-model="carrier[order.id]" placeholder="物流公司" /><el-input v-model="tracking[order.id]" placeholder="运单号" /><el-button type="primary" @click="ship(order.id)">确认发货</el-button></div></el-card></div>
  </section>
</template>
<style scoped>.page{padding:8px}.heading,.card-head,.item,.ship{display:flex;align-items:center;justify-content:space-between;gap:12px}.heading{margin-bottom:20px}.heading h2{margin:0}.heading p{margin:6px 0 0;color:#8490a0}.list{display:grid;gap:14px;min-height:160px}.item{padding:10px 0;border-top:1px solid #eef1f5}.ship{margin-top:14px;justify-content:flex-end}.ship .el-input{max-width:220px}@media(max-width:700px){.ship{align-items:stretch;flex-direction:column}.ship .el-input{max-width:none}}</style>
