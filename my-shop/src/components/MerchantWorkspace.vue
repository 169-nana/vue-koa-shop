<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { MerchantApplication } from '../../../shared/api'
import { getMerchantApplications } from '../api'

const route = useRoute(), router = useRouter()
const shops = ref<MerchantApplication[]>([])
const loading = ref(true), errorMessage = ref('')
const merchantId = computed(() => Number(route.params.merchantId))
const currentShop = computed(() => shops.value.find(item => item.id === merchantId.value) ?? null)

async function load() {
  loading.value = true; errorMessage.value = ''
  try {
    const applications = (await getMerchantApplications()).applications
    shops.value = applications.filter(item => item.status === 'approved' || item.status === 'suspended' || item.status === 'revoked')
    if (!shops.value.length) { await router.replace({ name: 'merchant-apply' }); return }
    if (!currentShop.value) {
      const fallback = shops.value.find(item => item.status === 'approved') ?? shops.value[0]
      await router.replace({ name: fallback.status === 'approved' ? 'merchant-overview' : 'merchant-stores', params: { merchantId: fallback.id } })
    }
    else if (currentShop.value.status !== 'approved' && route.name !== 'merchant-stores' && route.name !== 'merchant-messages') {
      await router.replace({ name: 'merchant-stores', params: { merchantId: currentShop.value.id } })
    }
  } catch (error: unknown) { errorMessage.value = error instanceof Error ? error.message : '商家管理台加载失败' }
  finally { loading.value = false }
}
watch(merchantId, async () => {
  if (!loading.value && shops.value.length && !currentShop.value) {
    const fallback = shops.value.find(item => item.status === 'approved') ?? shops.value[0]
    await router.replace({ name: fallback.status === 'approved' ? 'merchant-overview' : 'merchant-stores', params: { merchantId: fallback.id } })
  } else if (!loading.value && currentShop.value && currentShop.value.status !== 'approved' && route.name !== 'merchant-stores' && route.name !== 'merchant-messages') {
    await router.replace({ name: 'merchant-stores', params: { merchantId: merchantId.value } })
  }
})
onMounted(load)
</script>

<template>
  <main class="workspace">
    <header class="topbar">
      <RouterLink class="workspace-brand" :to="{ name: 'merchant-overview', params: { merchantId } }"><span>微</span><div><strong>商家管理台</strong><small>{{ currentShop?.shop_name || '店铺管理' }}</small></div></RouterLink>
      <div class="top-actions"><span v-if="currentShop">当前店铺：{{ currentShop.shop_name }}</span><RouterLink to="/">返回商城</RouterLink></div>
    </header>
    <div v-if="loading" class="workspace-state">管理台加载中……</div>
    <div v-else-if="errorMessage" class="workspace-state error"><p>{{ errorMessage }}</p><button type="button" @click="load">重新加载</button></div>
    <div v-else-if="currentShop" class="workspace-body">
      <aside>
        <p>店铺运营</p>
        <RouterLink :to="{ name: 'merchant-overview', params: { merchantId } }"><span>⌂</span>工作台</RouterLink>
        <template v-if="currentShop.status === 'approved'"><RouterLink :to="{ name: 'merchant-orders', params: { merchantId } }"><span>▤</span>订单履约</RouterLink><RouterLink :to="{ name: 'merchant-products', params: { merchantId } }"><span>□</span>商品管理</RouterLink><RouterLink :to="{ name: 'merchant-product-new', params: { merchantId } }"><span>＋</span>发布商品</RouterLink><RouterLink :to="{ name: 'merchant-submissions', params: { merchantId } }"><span>✓</span>发布记录</RouterLink></template>
        <span v-else class="operation-locked">店铺已受限，经营功能暂停</span>
        <p>店铺与账户</p>
        <RouterLink :to="{ name: 'merchant-stores', params: { merchantId } }"><span>◇</span>店铺管理</RouterLink>
        <RouterLink :to="{ name: 'merchant-messages', params: { merchantId } }"><span>○</span>消息中心</RouterLink>
      </aside>
      <section class="workspace-content"><RouterView /></section>
    </div>
  </main>
</template>

<style scoped>
.workspace{height:100vh;overflow:hidden;color:#283a30;background:#f4f6f4}.topbar{display:flex;box-sizing:border-box;height:70px;padding:0 28px;align-items:center;justify-content:space-between;border-bottom:1px solid #dfe6e1;background:white}.workspace-brand{display:flex;align-items:center;gap:11px}.workspace-brand>span{display:grid;width:38px;height:38px;place-items:center;border-radius:11px;color:white;background:#2d6a4f;font-weight:700}.workspace-brand strong,.workspace-brand small{display:block}.workspace-brand strong{font-size:17px}.workspace-brand small{margin-top:2px;color:#859188;font-size:11px}.top-actions{display:flex;align-items:center;gap:20px;color:#52645a;font-size:13px}.top-actions>span{padding:7px 11px;border-radius:999px;background:#f1f5f2}.workspace-body{display:grid;height:calc(100vh - 70px);grid-template-columns:210px minmax(0,1fr);overflow:hidden}aside{box-sizing:border-box;height:100%;padding:24px 14px;overflow-y:auto;border-right:1px solid #dfe6e1;background:white}aside p{margin:18px 13px 8px;color:#9aa39d;font-size:11px;font-weight:700;letter-spacing:.12em}aside p:first-child{margin-top:0}aside a{display:flex;height:43px;padding:0 13px;align-items:center;gap:11px;border-radius:9px;color:#596a60;font-size:14px}aside a span{width:18px;color:#839189;text-align:center}aside a:hover,aside a.router-link-active{color:#235f43;background:#eaf3ed;font-weight:600}.workspace-content{box-sizing:border-box;min-width:0;height:100%;padding:30px 32px 48px;overflow-y:auto;overscroll-behavior:contain}.workspace-state{display:grid;height:calc(100vh - 70px);place-items:center;align-content:center;color:#78867e}.workspace-state.error{color:#ad4938}.workspace-state button{padding:9px 17px;border:0;border-radius:999px;color:white;background:#2d6a4f;cursor:pointer}@media(max-width:760px){.topbar{height:66px;padding:10px 14px}.top-actions>span{display:none}.workspace-body{display:grid;height:calc(100vh - 66px);grid-template-rows:auto minmax(0,1fr);grid-template-columns:1fr}aside{display:flex;width:100%;height:auto;padding:8px;gap:4px;overflow-x:auto;overflow-y:hidden;border-right:0;border-bottom:1px solid #dfe6e1}aside p{display:none}aside a{flex:0 0 auto;height:38px;padding:0 11px;font-size:12px}.workspace-content{height:100%;padding:20px 16px 36px}}
</style>
<style scoped>.operation-locked{display:block;margin:8px 10px 14px;padding:10px;border-radius:8px;color:#a54837;background:#fff1ed;font-size:12px;line-height:1.5}</style>
