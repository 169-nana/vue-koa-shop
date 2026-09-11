<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { MerchantApplication, MerchantGoodsItem } from '../../../../shared/api'
import { getMerchantApplications, getMerchantGoods, updateMerchantSaleStatus, updateMerchantStock } from '../../api'
import { toAssetURL } from '../../config'

const route = useRoute(), router = useRouter()
const merchantId = computed(() => Number(route.params.merchantId))
const goods = ref<MerchantGoodsItem[]>([])
const shops = ref<MerchantApplication[]>([])
const keyword = ref(''), status = ref<'all' | 'on_sale' | 'off_sale'>('all')
const loading = ref(true), errorMessage = ref(''), successMessage = ref('')
const filteredGoods = computed(() => goods.value.filter(item =>
  (status.value === 'all' || item.sale_status === status.value) &&
  (!keyword.value.trim() || item.name.toLowerCase().includes(keyword.value.trim().toLowerCase()))
))
async function load() {
  loading.value = true; errorMessage.value = ''
  try {
    const [goodsList, applications] = await Promise.all([getMerchantGoods(merchantId.value), getMerchantApplications()])
    goods.value = goodsList
    shops.value = applications.applications.filter(item => item.status === 'approved')
  }
  catch (error: unknown) { errorMessage.value = error instanceof Error ? error.message : '商品加载失败' }
  finally { loading.value = false }
}
async function switchShop(event: Event) {
  const select = event.target
  if (!(select instanceof HTMLSelectElement)) return
  await router.push({ name: 'merchant-products', params: { merchantId: Number(select.value) } })
}
async function saveStock(item: MerchantGoodsItem) {
  errorMessage.value = ''; successMessage.value = ''
  if (!Number.isInteger(item.stock) || item.stock < 0) { errorMessage.value = '库存必须是非负整数'; return }
  try { await updateMerchantStock(merchantId.value, { id: item.id, stock: item.stock }); successMessage.value = `“${item.name}”库存已保存` }
  catch (error: unknown) { errorMessage.value = error instanceof Error ? error.message : '库存更新失败'; await load() }
}
async function toggleSale(item: MerchantGoodsItem) {
  errorMessage.value = ''; successMessage.value = ''
  if (item.compliance_status === 'forced_off_sale') { errorMessage.value = '该商品已被平台强制下架，请修改资料并重新提交审核'; return }
  const next = item.sale_status === 'on_sale' ? 'off_sale' : 'on_sale'
  try { await updateMerchantSaleStatus(merchantId.value, { id: item.id, sale_status: next }); item.sale_status = next; successMessage.value = `“${item.name}”已${next === 'on_sale' ? '上架' : '下架'}` }
  catch (error: unknown) { errorMessage.value = error instanceof Error ? error.message : '上下架失败' }
}
watch(merchantId, load)
onMounted(load)
</script>

<template>
  <div>
    <div class="heading"><div><p>PRODUCTS</p><h1>商品管理</h1><span>统一维护已通过商品的库存和销售状态。</span></div><RouterLink class="primary" :to="{ name: 'merchant-product-new', params: { merchantId } }">发布新商品</RouterLink></div>
    <p v-if="errorMessage" class="notice error">{{ errorMessage }}</p><p v-if="successMessage" class="notice success">{{ successMessage }}</p>
    <section class="shop-switch"><div><strong>管理店铺</strong><small>切换后只显示该店铺的商品</small></div><select :value="merchantId" @change="switchShop"><option v-for="shop in shops" :key="shop.id" :value="shop.id">{{ shop.shop_name }}</option></select></section>
    <section class="toolbar"><input v-model.trim="keyword" placeholder="搜索商品名称"><select v-model="status"><option value="all">全部状态</option><option value="on_sale">已上架</option><option value="off_sale">已下架</option></select><span>共 {{ filteredGoods.length }} 件</span></section>
    <section class="panel"><p v-if="loading" class="empty">商品加载中……</p><p v-else-if="!filteredGoods.length" class="empty">没有符合条件的商品</p><div v-else class="product-list"><article v-for="item in filteredGoods" :key="item.id"><img :src="toAssetURL(item.picture)" :alt="item.name"><div class="product-main"><div><strong>{{ item.name }}</strong><span :class="item.sale_status">{{ item.sale_status === 'on_sale' ? '已上架' : '已下架' }}</span><span v-if="item.compliance_status === 'forced_off_sale'" class="forced">平台下架</span></div><p>¥{{ item.price.toFixed(2) }} · {{ item.spec || '默认规格' }}</p><small>{{ item.compliance_reason || `商品编号：${item.id}` }}</small></div><label>库存<input v-model.number="item.stock" type="number" min="0" step="1"></label><div class="actions"><button @click="saveStock(item)">保存库存</button><button :disabled="item.compliance_status === 'forced_off_sale'" @click="toggleSale(item)">{{ item.compliance_status === 'forced_off_sale' ? '禁止上架' : item.sale_status === 'on_sale' ? '下架' : '上架' }}</button><RouterLink :to="{ name: 'merchant-product-edit', params: { merchantId }, query: { goods_id: item.id } }">{{ item.compliance_status === 'forced_off_sale' ? '整改并提交' : '提交修改' }}</RouterLink></div></article></div></section>
  </div>
</template>

<style scoped>
.heading{display:flex;align-items:end;justify-content:space-between;gap:20px}.heading>div>p{margin:0 0 7px;color:#809087;font-size:10px;font-weight:700;letter-spacing:.2em}.heading h1{margin:0;font-size:30px}.heading span{display:block;margin-top:7px;color:#78867e;font-size:13px}.primary{padding:10px 18px;border-radius:999px;color:white;background:#2d6a4f}.shop-switch{display:flex;margin-top:22px;padding:13px 15px;align-items:center;justify-content:space-between;gap:18px;border:1px solid #dbe5de;border-radius:13px;background:#f9fbf9}.shop-switch strong,.shop-switch small{display:block}.shop-switch small{margin-top:3px;color:#849088;font-size:11px}.shop-switch select{min-width:220px;padding:9px 32px 9px 11px;border:1px solid #cbd8cf;border-radius:8px;background:white;font:inherit}.toolbar{display:flex;margin-top:10px;padding:15px;align-items:center;gap:10px;border:1px solid #e0e7e2;border-radius:14px;background:white}.toolbar input,.toolbar select{padding:10px 12px;border:1px solid #d2ddd5;border-radius:8px;font:inherit}.toolbar input{flex:1;min-width:150px}.toolbar span{margin-left:auto;color:#849088;font-size:13px}.panel{margin-top:14px;padding:20px;border:1px solid #e0e7e2;border-radius:16px;background:white}.product-list{display:grid;gap:10px}.product-list article{display:grid;padding:14px;align-items:center;grid-template-columns:64px minmax(180px,1fr) 100px auto;gap:15px;border:1px solid #e8ede9;border-radius:12px}.product-list img{width:64px;height:64px;border-radius:9px;object-fit:cover}.product-main>div{display:flex;align-items:center;gap:9px}.product-main span{padding:4px 8px;border-radius:999px;font-size:11px}.on_sale{color:#286347;background:#e8f5ec}.off_sale{color:#777f7a;background:#ecefed}.product-main p{margin:6px 0;color:#75837b;font-size:13px}.product-main small{color:#9aa29d}.product-list label{display:grid;gap:6px;color:#7b8981;font-size:12px}.product-list label input{width:100%;padding:8px;border:1px solid #d2ddd5;border-radius:7px}.actions{display:flex;gap:7px}.actions button,.actions a{padding:8px 10px;border:1px solid #cbd8cf;border-radius:7px;color:#35664f;background:white;cursor:pointer;font-size:12px}.notice{padding:12px 15px;border-radius:9px}.error{color:#a94736;background:#fff0eb}.success{color:#286347;background:#ebf7ef}.empty{padding:45px;text-align:center;color:#849088}@media(max-width:900px){.product-list article{grid-template-columns:54px 1fr}.product-list img{width:54px;height:54px}.product-list label,.actions{grid-column:2}.actions{flex-wrap:wrap}}@media(max-width:560px){.heading{align-items:flex-start;flex-direction:column}.shop-switch,.toolbar{align-items:stretch;flex-direction:column}.shop-switch select{min-width:0}.toolbar span{margin-left:0}.product-list article{grid-template-columns:46px 1fr;padding:11px}.product-list img{width:46px;height:46px}}
</style>
<style scoped>.product-main .forced{color:#a54837;background:#ffebe7}.actions button:disabled{opacity:.55;cursor:not-allowed}</style>
