<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { GoodsSubmission, MerchantGoodsItem } from '../../../../shared/api'
import { getMerchantGoods, getMerchantSubmissions } from '../../api'
import { toAssetURL } from '../../config'

const route = useRoute()
const merchantId = computed(() => Number(route.params.merchantId))
const submissions = ref<GoodsSubmission[]>([]), goods = ref<MerchantGoodsItem[]>([])
const loading = ref(true), errorMessage = ref('')
const pending = computed(() => submissions.value.filter(item => item.status === 'pending').length)
const rejected = computed(() => submissions.value.filter(item => item.status === 'rejected').length)
const approved = computed(() => submissions.value.filter(item => item.status === 'approved').length)
const onSale = computed(() => goods.value.filter(item => item.sale_status === 'on_sale').length)
const recent = computed(() => submissions.value.filter(item => item.status !== 'draft').slice(0, 5))
const statusText: Record<GoodsSubmission['status'], string> = { draft: '草稿', pending: '审核中', rejected: '已拒绝', approved: '已通过' }

async function load() {
  loading.value = true; errorMessage.value = ''
  try { [submissions.value, goods.value] = await Promise.all([getMerchantSubmissions(merchantId.value), getMerchantGoods(merchantId.value)]) }
  catch (error: unknown) { errorMessage.value = error instanceof Error ? error.message : '工作台加载失败' }
  finally { loading.value = false }
}
watch(merchantId, load)
onMounted(load)
</script>

<template>
  <div class="overview-page">
    <div class="heading"><div><p>OVERVIEW</p><h1>工作台</h1><span>快速了解店铺当前需要处理的事项。</span></div><RouterLink class="primary" :to="{ name: 'merchant-product-new', params: { merchantId } }">发布新商品</RouterLink></div>
    <p v-if="errorMessage" class="notice">{{ errorMessage }}</p>
    <section class="metrics"><RouterLink :to="{ name: 'merchant-submissions', params: { merchantId }, query: { status: 'pending' } }"><span>审核中</span><strong>{{ pending }}</strong><small>等待平台处理</small></RouterLink><RouterLink :to="{ name: 'merchant-submissions', params: { merchantId }, query: { status: 'rejected' } }"><span>需要修改</span><strong>{{ rejected }}</strong><small>查看拒绝原因</small></RouterLink><RouterLink :to="{ name: 'merchant-submissions', params: { merchantId }, query: { status: 'approved' } }"><span>审核通过</span><strong>{{ approved }}</strong><small>查看发布记录</small></RouterLink><RouterLink :to="{ name: 'merchant-products', params: { merchantId } }"><span>正在销售</span><strong>{{ onSale }}</strong><small>共 {{ goods.length }} 件商品</small></RouterLink></section>
    <section class="panel"><div class="panel-heading"><div><h2>最近发布记录</h2><p>展示最近五条已进入审核流程的商品</p></div><RouterLink :to="{ name: 'merchant-submissions', params: { merchantId } }">查看全部 ›</RouterLink></div><p v-if="loading" class="empty">数据加载中……</p><p v-else-if="!recent.length" class="empty">暂无发布记录</p><div v-else class="recent-list"><article v-for="item in recent" :key="item.id"><img :src="toAssetURL(item.picture)" alt=""><div><strong>{{ item.name }}</strong><p>¥{{ item.price.toFixed(2) }} · {{ item.action === 'create' ? '发布商品' : '修改商品' }}</p></div><span :class="item.status">{{ statusText[item.status] }}</span></article></div></section>
    <section class="quick"><div><h2>常用功能</h2><p>将高频操作集中在这里。</p></div><RouterLink :to="{ name: 'merchant-product-new', params: { merchantId } }">＋ 发布商品</RouterLink><RouterLink :to="{ name: 'merchant-products', params: { merchantId } }">□ 管理库存</RouterLink><RouterLink to="/merchant/apply">◇ 管理店铺</RouterLink><RouterLink to="/notifications">○ 查看消息</RouterLink></section>
  </div>
</template>

<style scoped>
.heading,.panel-heading{display:flex;align-items:end;justify-content:space-between;gap:20px}.heading>div>p{margin:0 0 7px;color:#809087;font-size:10px;font-weight:700;letter-spacing:.2em}.heading h1{margin:0;font-size:30px}.heading span,.panel-heading p{display:block;margin-top:7px;color:#78867e;font-size:13px}.primary{padding:10px 18px;border-radius:999px;color:white;background:#2d6a4f}.metrics{display:grid;margin-top:24px;grid-template-columns:repeat(4,1fr);gap:14px}.metrics a{display:grid;padding:20px;border:1px solid #e0e7e2;border-radius:15px;background:white;box-shadow:0 8px 24px #294a3508}.metrics span{color:#65756c;font-size:13px}.metrics strong{margin:10px 0 7px;font-size:30px}.metrics small{color:#98a19b}.panel,.quick{margin-top:18px;padding:24px;border:1px solid #e0e7e2;border-radius:17px;background:white}.panel-heading h2,.quick h2{margin:0;font-size:20px}.panel-heading a{color:#2d6a4f;font-size:13px}.recent-list{display:grid;margin-top:18px}.recent-list article{display:grid;padding:13px 0;align-items:center;grid-template-columns:48px 1fr auto;gap:13px;border-top:1px solid #edf0ee}.recent-list img{width:48px;height:48px;border-radius:8px;object-fit:cover}.recent-list p{margin:5px 0 0;color:#839087;font-size:12px}.recent-list>article>span{padding:5px 9px;border-radius:999px;font-size:11px}.pending{color:#8d651d;background:#fff4d5}.rejected{color:#a74837;background:#ffece7}.approved{color:#286347;background:#e8f5ec}.quick{display:grid;align-items:center;grid-template-columns:1fr repeat(4,auto);gap:10px}.quick p{margin:6px 0 0;color:#849088;font-size:13px}.quick>a{padding:10px 13px;border:1px solid #d7e1da;border-radius:9px;color:#456052}.notice{padding:12px 15px;border-radius:9px;color:#a94736;background:#fff0eb}.empty{padding:38px;text-align:center;color:#849088}@media(max-width:1000px){.metrics{grid-template-columns:repeat(2,1fr)}.quick{grid-template-columns:repeat(2,1fr)}.quick>div{grid-column:1/-1}}@media(max-width:560px){.heading{align-items:flex-start;flex-direction:column}.metrics{gap:8px}.metrics a{padding:15px}.quick{padding:18px}.recent-list article{grid-template-columns:42px 1fr}.recent-list>article>span{grid-column:2}}
</style>
