<template>
  <div class="dashboard">
    <header class="welcome">
      <div><span class="eyebrow">商城工作台</span><h1>欢迎回来，{{ admin.username || '管理员' }}</h1><p>查看商品概况，及时处理库存，让日常管理更有条理。</p></div>
      <div class="welcome-actions"><span aria-live="polite">{{ updatedAt ? `更新于 ${updatedAt}` : '尚未更新' }}</span><el-button :icon="Refresh" :loading="loading" @click="loadOverview">刷新数据</el-button></div>
    </header>

    <el-alert v-if="failed" title="概况加载失败，请刷新重试" :description="overview ? '当前保留上次成功加载的数据，可能不是最新状态。' : '暂时无法获取商品数据。你仍可以使用下方快捷入口。'" type="error" show-icon :closable="false" />
    <section class="metrics" aria-label="商品概况" :aria-busy="loading">
      <router-link v-for="metric in metrics" :key="metric.label" :to="metric.to" class="metric">
        <div class="metric-top"><span>{{ metric.label }}</span><el-icon :class="['metric-icon', metric.tone]"><component :is="metric.icon" /></el-icon></div>
        <el-skeleton v-if="loading && !overview" :rows="1" animated />
        <div v-else class="metric-value">{{ metric.value === undefined ? '—' : metric.value.toLocaleString('zh-CN') }}<small> {{ metric.unit }}</small></div>
        <div class="metric-bottom"><span>{{ metric.hint }}</span><el-icon><ArrowRight /></el-icon></div>
      </router-link>
    </section>

    <div class="workspace-grid">
      <section class="panel inventory-panel">
        <div class="panel-heading"><div><h2>库存关注</h2><p>库存不超过 10 件的商品，最多展示 5 条</p></div><router-link :to="{ name: 'goods', query: { stock: 'attention' } }">查看全部 →</router-link></div>
        <el-skeleton v-if="loading && !overview" :rows="5" animated />
        <el-empty v-else-if="!overview" description="暂无可用数据，请刷新重试" />
        <el-empty v-else-if="!overview.attention.length" :description="overview.total ? '库存充足，暂无需要关注的商品' : '还没有商品，先添加第一件商品吧'">
          <el-button v-if="!overview.total" type="primary" @click="router.push({ name: 'goods', query: { action: 'create' } })">新增商品</el-button>
        </el-empty>
        <ul v-else class="inventory-list">
          <li v-for="goods in overview.attention" :key="goods.id">
            <el-image :src="toAssetURL(goods.picture)" fit="cover" class="goods-image"><template #error><el-icon><Picture /></el-icon></template></el-image>
            <div class="goods-copy"><strong>{{ goods.name }}</strong><span>{{ goods.category_name || '未分类' }} · ¥{{ goods.price.toFixed(2) }}</span></div>
            <el-tag :type="goods.stock === 0 ? 'danger' : 'warning'" effect="light">{{ goods.stock === 0 ? '已售罄' : `剩余 ${goods.stock} 件` }}</el-tag>
            <router-link :to="{ name: 'goods', query: { edit: String(goods.id) } }"><span :aria-label="`编辑商品：${goods.name}`">编辑</span></router-link>
          </li>
        </ul>
      </section>
      <section class="panel shortcuts">
        <div class="panel-heading"><div><h2>快捷操作</h2><p>常用功能，一步直达</p></div></div>
        <router-link v-for="action in actions" :key="action.title" :to="action.to" class="shortcut"><el-icon><component :is="action.icon" /></el-icon><div><strong>{{ action.title }}</strong><span>{{ action.description }}</span></div><el-icon class="shortcut-arrow"><ArrowRight /></el-icon></router-link>
      </section>
    </div>
    <footer class="overview-note">统计口径：当前全部商品；低库存为 1–10 件，售罄为 0 件。分类数量包含一级和二级分类。</footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight, Box, Folder, Warning, CircleClose, Plus, Setting, Refresh, Picture } from '@element-plus/icons-vue'
import type { GoodsListItem } from '../../../../shared/api'
import { getCategoryList, getGoodsList } from '../../api'
import { toAssetURL } from '../../config'
import useAdmin from '../../stores/admin'

interface Overview { total: number; categories: number; lowStock: number; soldOut: number; attention: GoodsListItem[] }
const router = useRouter()
const { admin } = useAdmin()
const overview = ref<Overview | null>(null)
const loading = ref(false)
const failed = ref(false)
const updatedAt = ref('')
const metrics = computed(() => [
  { label: '商品总数', value: overview.value?.total, unit: '款', hint: '查看全部商品', icon: Box, tone: 'blue', to: { name: 'goods' } },
  { label: '商品分类', value: overview.value?.categories, unit: '个', hint: '整理商品分类', icon: Folder, tone: 'purple', to: { name: 'goods' } },
  { label: '低库存商品', value: overview.value?.lowStock, unit: '款', hint: '库存 1–10 件，建议补货', icon: Warning, tone: 'amber', to: { name: 'goods', query: { stock: 'low' } } },
  { label: '售罄商品', value: overview.value?.soldOut, unit: '款', hint: '库存为 0，及时处理', icon: CircleClose, tone: 'red', to: { name: 'goods', query: { stock: 'empty' } } }
])
const actions = [
  { title: '新增商品', description: '完善商品信息与图片', icon: Plus, to: { name: 'goods', query: { action: 'create' } } },
  { title: '商品管理', description: '查询商品、调整价格和库存', icon: Box, to: { name: 'goods' } },
  { title: '新增分类', description: '建立清晰的商品分类', icon: Folder, to: { name: 'goods', query: { action: 'category' } } },
  { title: '个人中心', description: '管理头像与账号设置', icon: Setting, to: { name: 'setting' } }
]
async function loadOverview() {
  if (loading.value) return
  loading.value = true
  failed.value = false
  try {
    const [all, categories, low, empty, attention] = await Promise.allSettled([
      getGoodsList({ page: 1, pagesize: 1 }), getCategoryList(),
      getGoodsList({ page: 1, pagesize: 1, min_stock: 1, max_stock: 10 }),
      getGoodsList({ page: 1, pagesize: 1, max_stock: 0 }),
      getGoodsList({ page: 1, pagesize: 5, max_stock: 10 })
    ])
    if (all.status !== 'fulfilled' || categories.status !== 'fulfilled' || low.status !== 'fulfilled' || empty.status !== 'fulfilled' || attention.status !== 'fulfilled') {
      failed.value = true
      return
    }
    overview.value = { total: all.value.total, categories: categories.value.length, lowStock: low.value.total, soldOut: empty.value.total, attention: attention.value.list }
    updatedAt.value = new Date().toLocaleString('zh-CN', { hour12: false })
  } finally { loading.value = false }
}
onMounted(loadOverview)
</script>

<style scoped lang="scss">
.dashboard { max-width: 1440px; margin: 0 auto; color: #24334b; }
.welcome { display: flex; justify-content: space-between; align-items: center; gap: 24px; margin-bottom: 28px; }
.eyebrow { color: #5275a9; font-size: 13px; font-weight: 600; letter-spacing: 2px; }
h1 { font-size: 26px; margin: 10px 0; overflow-wrap: anywhere; }
.welcome p, .panel-heading p { color: #69788c; font-size: 13px; line-height: 1.7; margin: 0; }
.welcome-actions { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.welcome-actions > span { color: #69788c; font-size: 12px; }
.metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px; margin: 22px 0; }
.metric, .panel { background: #fff; border: 1px solid #e4eaf2; border-radius: 12px; }
.metric { color: inherit; padding: 22px; transition: border-color .2s, box-shadow .2s; }
.metric:hover { border-color: #99b9ed; box-shadow: 0 5px 16px #24476b0a; }
.metric-top, .metric-bottom { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.metric-top { font-size: 14px; color: #58687f; }
.metric-icon { width: 38px; height: 38px; border-radius: 10px; font-size: 22px; }
.blue { color: #3675df; background: #edf4ff; }.purple { color: #8062c5; background: #f3effc; }.amber { color: #a66a08; background: #fff6e4; }.red { color: #c74848; background: #fff0f0; }
.metric-value { margin: 18px 0; font-size: 32px; font-weight: 650; font-variant-numeric: tabular-nums; }
.metric-value small { font-size: 13px; font-weight: 400; color: #718096; }
.metric-bottom { padding-top: 14px; border-top: 1px solid #eff2f6; font-size: 12px; color: #69788c; }
.workspace-grid { display: grid; grid-template-columns: minmax(0, 1.8fr) minmax(280px, 1fr); gap: 22px; }
.panel { padding: 24px; min-width: 0; }
.panel-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 22px; }
h2 { font-size: 17px; margin: 0 0 7px; }
.panel a { color: #326ec5; font-size: 13px; }
.panel-heading > a { white-space: nowrap; }
.inventory-list { list-style: none; margin: 0; padding: 0; }
.inventory-list li { display: flex; align-items: center; gap: 14px; padding: 16px 0; border-bottom: 1px solid #eff2f6; }
.inventory-list li:last-child { border-bottom: 0; }
.goods-image { width: 48px; height: 48px; flex: 0 0 48px; border-radius: 8px; background: #f3f6fa; display: flex; align-items: center; justify-content: center; }
.goods-copy { flex: 1; min-width: 0; }.goods-copy strong { display: block; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.goods-copy span { display: block; color: #69788c; font-size: 12px; margin-top: 6px; }
.shortcut { display: flex; align-items: center; gap: 14px; padding: 16px 12px; border-radius: 8px; }.shortcut:hover { background: #f5f8fd; }.shortcut > .el-icon { font-size: 21px; }.shortcut div { flex: 1; }.shortcut strong { display: block; color: #24334b; font-size: 14px; }.shortcut span { display: block; color: #69788c; font-size: 12px; margin-top: 6px; }.shortcut .shortcut-arrow { font-size: 14px; }
.overview-note { margin-top: 20px; color: #69788c; font-size: 12px; line-height: 1.8; }
a:focus-visible { outline: 2px solid #3675df; outline-offset: 3px; }
@media (max-width: 1200px) { .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }.welcome { align-items: flex-start; flex-direction: column; }.workspace-grid { grid-template-columns: 1fr; } }
@media (max-width: 600px) { .metrics { grid-template-columns: 1fr; gap: 12px; }.panel { padding: 16px; }h1 { font-size: 22px; }.inventory-list li { flex-wrap: wrap; gap: 10px; }.goods-copy { min-width: 130px; }.welcome { margin-bottom: 18px; } }
</style>
