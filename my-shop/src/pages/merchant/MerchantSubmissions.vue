<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { GoodsSubmission, GoodsSubmissionStatus } from '../../../../shared/api'
import { getMerchantSubmissions, submitMerchantGoods } from '../../api'
import { toAssetURL } from '../../config'

const route = useRoute(), router = useRouter()
const merchantId = computed(() => Number(route.params.merchantId))
const submissions = ref<GoodsSubmission[]>([])
const loading = ref(true), errorMessage = ref(''), successMessage = ref(route.query.saved === '1' ? '商品资料已保存' : '')
const validStatuses: GoodsSubmissionStatus[] = ['draft', 'pending', 'rejected', 'approved']
const activeStatus = computed(() => validStatuses.find(item => item === route.query.status) ?? 'pending')
const filtered = computed(() => submissions.value.filter(item => item.status === activeStatus.value))
const counts = computed<Record<GoodsSubmissionStatus, number>>(() => ({
  draft: submissions.value.filter(item => item.status === 'draft').length,
  pending: submissions.value.filter(item => item.status === 'pending').length,
  rejected: submissions.value.filter(item => item.status === 'rejected').length,
  approved: submissions.value.filter(item => item.status === 'approved').length
}))
const statusText: Record<GoodsSubmissionStatus, string> = { draft: '草稿', pending: '审核中', rejected: '已拒绝', approved: '已通过' }
async function load() {
  loading.value = true; errorMessage.value = ''
  try { submissions.value = await getMerchantSubmissions(merchantId.value) }
  catch (error: unknown) { errorMessage.value = error instanceof Error ? error.message : '发布记录加载失败' }
  finally { loading.value = false }
}
async function selectStatus(status: GoodsSubmissionStatus) {
  successMessage.value = ''
  await router.replace({ name: 'merchant-submissions', params: { merchantId: merchantId.value }, query: { status } })
}
async function submit(item: GoodsSubmission) {
  errorMessage.value = ''; successMessage.value = ''
  try { await submitMerchantGoods(merchantId.value, item.id); successMessage.value = `“${item.name}”已提交审核`; await selectStatus('pending'); await load() }
  catch (error: unknown) { errorMessage.value = error instanceof Error ? error.message : '提交失败' }
}
watch(merchantId, load)
onMounted(load)
</script>

<template>
  <div>
    <div class="heading"><div><p>SUBMISSIONS</p><h1>发布记录</h1><span>草稿与审核记录集中管理，库存操作不会出现在这里。</span></div><RouterLink class="primary" :to="{ name: 'merchant-product-new', params: { merchantId } }">发布新商品</RouterLink></div>
    <p v-if="errorMessage" class="notice error">{{ errorMessage }}</p><p v-if="successMessage" class="notice success">{{ successMessage }}</p>
    <nav class="tabs" aria-label="发布记录状态"><button v-for="status in validStatuses" :key="status" :class="{ active: activeStatus === status }" @click="selectStatus(status)">{{ statusText[status] }} <b>{{ counts[status] }}</b></button></nav>
    <section class="panel"><p v-if="loading" class="empty">发布记录加载中……</p><p v-else-if="!filtered.length" class="empty">当前状态下没有商品记录</p><div v-else class="list"><article v-for="item in filtered" :key="item.id"><img :src="toAssetURL(item.picture)" :alt="item.name"><div class="main"><div><strong>{{ item.name }}</strong><span :class="item.status">{{ statusText[item.status] }}</span></div><p>¥{{ item.price.toFixed(2) }} · {{ item.action === 'create' ? '发布新商品' : '修改已有商品' }}</p><small>{{ item.submitted_at ? `提交于 ${new Date(item.submitted_at).toLocaleString()}` : `更新于 ${new Date(item.updated_at).toLocaleString()}` }}</small><div v-if="item.rejection_reason" class="reason"><b>审核意见</b><p>{{ item.rejection_reason }}</p></div></div><div class="actions"><RouterLink v-if="item.status === 'draft' || item.status === 'rejected'" :to="{ name: 'merchant-product-edit', params: { merchantId }, query: { submission_id: item.id } }">修改资料</RouterLink><button v-if="item.status === 'draft' || item.status === 'rejected'" class="primary" @click="submit(item)">{{ item.status === 'rejected' ? '重新提交' : '提交审核' }}</button><RouterLink v-if="item.status === 'approved' && item.goods_id" :to="{ name: 'merchant-product-edit', params: { merchantId }, query: { goods_id: item.goods_id } }">再次修改</RouterLink></div></article></div></section>
  </div>
</template>

<style scoped>
.heading{display:flex;align-items:end;justify-content:space-between;gap:20px}.heading>div>p{margin:0 0 7px;color:#809087;font-size:10px;font-weight:700;letter-spacing:.2em}.heading h1{margin:0;font-size:30px}.heading span{display:block;margin-top:7px;color:#78867e;font-size:13px}.primary{padding:10px 17px;border:0!important;border-radius:999px!important;color:white!important;background:#2d6a4f!important}.tabs{display:flex;margin-top:22px;padding:7px;gap:5px;border:1px solid #e0e7e2;border-radius:13px;background:white}.tabs button{padding:9px 15px;border:0;border-radius:8px;color:#65756c;background:transparent;cursor:pointer}.tabs button.active{color:#245f43;background:#e8f3ec;font-weight:600}.tabs b{margin-left:5px;padding:2px 6px;border-radius:999px;background:#dfe9e2;font-size:10px}.panel{margin-top:13px;padding:20px;border:1px solid #e0e7e2;border-radius:16px;background:white}.list{display:grid;gap:11px}.list article{display:grid;padding:15px;grid-template-columns:72px minmax(0,1fr) auto;gap:16px;border:1px solid #e7ece8;border-radius:13px}.list>article>img{width:72px;height:72px;border-radius:9px;object-fit:cover}.main>div:first-child{display:flex;align-items:center;gap:9px}.main>div:first-child span{padding:4px 8px;border-radius:999px;font-size:11px}.draft{color:#68736c;background:#edf0ee}.pending{color:#8d651d;background:#fff4d5}.rejected{color:#a74837;background:#ffece7}.approved{color:#286347;background:#e8f5ec}.main>p{margin:7px 0;color:#748179;font-size:13px}.main>small{color:#969f99}.reason{margin-top:12px;padding:10px 12px;border-radius:8px;color:#a74837;background:#fff3ef;font-size:12px}.reason p{margin:5px 0 0;line-height:1.6;white-space:pre-wrap}.actions{display:flex;align-items:center;gap:7px}.actions a,.actions button{padding:8px 11px;border:1px solid #cad7ce;border-radius:8px;color:#35664f;background:white;cursor:pointer;font-size:12px}.notice{padding:12px 15px;border-radius:9px}.error{color:#a94736;background:#fff0eb}.success{color:#286347;background:#ebf7ef}.empty{padding:50px;text-align:center;color:#849088}@media(max-width:760px){.heading{align-items:flex-start;flex-direction:column}.tabs{overflow-x:auto}.tabs button{flex:0 0 auto}.list article{grid-template-columns:52px 1fr}.list>article>img{width:52px;height:52px}.actions{grid-column:2;flex-wrap:wrap}.panel{padding:13px}}
</style>
