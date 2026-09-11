<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { Category, CursorPageResult, Goods } from '../../../shared/api'
import { getCategories, getGoodsList } from '../api'
import GoodsCard from '../components/GoodsCard.vue'
import ShopAccountNav from '../components/ShopAccountNav.vue'

const PAGE_SIZE = 20
const route = useRoute()
const categories = ref<Category[]>([])
const goodsList = ref<Goods[]>([])
const hasMore = ref(false)
const nextLastId = ref(0)
const loading = ref(true)
const loadingMore = ref(false)
const errorMessage = ref('')
const loadTrigger = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null
let requestVersion = 0
let disposed = false

const categoryId = computed(() => {
  const value = Number(route.params.id)
  return Number.isInteger(value) && value > 0 ? value : 0
})
const currentCategory = computed(() => categories.value.find(item => item.id === categoryId.value) ?? null)
const parentCategory = computed(() => {
  const current = currentCategory.value
  if (!current || current.pid === 0) return current
  return categories.value.find(item => item.id === current.pid) ?? null
})
const siblingCategories = computed(() => {
  const parentId = parentCategory.value?.id
  return parentId ? categories.value.filter(item => item.pid === parentId) : []
})

function getErrorMessage(error: unknown) { return error instanceof Error ? error.message : '数据加载失败，请稍后重试' }
function applyGoodsPage(data: CursorPageResult<Goods>, append: boolean) {
  goodsList.value = append ? [...goodsList.value, ...data.list] : data.list
  hasMore.value = data.hasMore
  nextLastId.value = data.nextLastId
}
async function observeListEnd() {
  await nextTick()
  if (disposed || !observer) return
  observer.disconnect()
  if (!loading.value && !loadingMore.value && !errorMessage.value && hasMore.value && goodsList.value.length && loadTrigger.value) observer.observe(loadTrigger.value)
}
watch([loading, loadingMore, hasMore, errorMessage], observeListEnd)
async function loadCategoryPage() {
  const version = ++requestVersion
  loading.value = true
  errorMessage.value = ''
  goodsList.value = []
  try {
    const [categoryData, goodsData] = await Promise.all([
      getCategories(),
      getGoodsList({ last_id: 0, pagesize: PAGE_SIZE, category_id: categoryId.value })
    ])
    if (disposed || version !== requestVersion) return
    categories.value = categoryData
    applyGoodsPage(goodsData, false)
  } catch (error: unknown) {
    if (!disposed && version === requestVersion) errorMessage.value = getErrorMessage(error)
  } finally {
    if (version === requestVersion) loading.value = false
  }
}
async function loadMore() {
  if (loading.value || loadingMore.value || !hasMore.value || !categoryId.value) return
  loadingMore.value = true
  errorMessage.value = ''
  try {
    const data = await getGoodsList({ last_id: nextLastId.value, pagesize: PAGE_SIZE, category_id: categoryId.value })
    if (data.hasMore && (!data.list.length || data.nextLastId === nextLastId.value)) throw new Error('商品加载暂时异常，请重试')
    applyGoodsPage(data, true)
  } catch (error: unknown) { errorMessage.value = getErrorMessage(error) } finally { loadingMore.value = false }
}

watch(categoryId, () => { window.scrollTo({ top: 0 }); void loadCategoryPage() })
onMounted(() => {
  observer = new IntersectionObserver(entries => {
    if (!disposed && !errorMessage.value && entries.some(entry => entry.isIntersecting)) void loadMore()
  }, { rootMargin: '0px 0px 240px 0px' })
  void loadCategoryPage()
})
onUnmounted(() => { disposed = true; observer?.disconnect(); observer = null })
</script>

<template>
  <main class="category-page">
    <header class="header">
      <RouterLink class="brand" to="/"><span class="brand-mark">微</span><span><strong>微商城</strong><small>简单、安心地选购好物</small></span></RouterLink>
      <ShopAccountNav />
    </header>

    <nav class="breadcrumb" aria-label="面包屑导航">
      <RouterLink to="/">首页</RouterLink><span>/</span>
      <RouterLink v-if="currentCategory?.pid" :to="{ name: 'category-goods', params: { id: parentCategory?.id } }">{{ parentCategory?.name }}</RouterLink>
      <span v-if="currentCategory?.pid">/</span><strong>{{ currentCategory?.name || '分类商品' }}</strong>
    </nav>

    <section class="category-hero">
      <div><p>CATEGORY COLLECTION</p><h1>{{ currentCategory?.name || '分类商品' }}</h1><span>{{ currentCategory?.pid ? `来自 ${parentCategory?.name || '精选'} 分类` : '为你汇集该分类下的精选商品' }}</span></div>
      <div class="hero-number">{{ String(currentCategory?.id || 0).padStart(2, '0') }}</div>
    </section>

    <section v-if="siblingCategories.length" class="subcategories" aria-label="同级分类">
      <RouterLink v-if="parentCategory" :to="{ name: 'category-goods', params: { id: parentCategory.id } }" :class="{ active: categoryId === parentCategory.id }">全部 {{ parentCategory.name }}</RouterLink>
      <RouterLink v-for="category in siblingCategories" :key="category.id" :to="{ name: 'category-goods', params: { id: category.id } }" :class="{ active: categoryId === category.id }">{{ category.name }}</RouterLink>
    </section>

    <section class="goods-section" aria-labelledby="category-goods-title">
      <div class="section-heading"><div><p>PRODUCTS</p><h2 id="category-goods-title">{{ currentCategory?.name || '商品列表' }}</h2></div><span v-if="goodsList.length">已展示 {{ goodsList.length }} 件</span></div>
      <div v-if="loading" class="state-panel"><span class="spinner" aria-hidden="true" /><p>正在加载商品……</p></div>
      <div v-else-if="errorMessage && !goodsList.length" class="state-panel error-panel"><p>{{ errorMessage }}</p><button type="button" @click="loadCategoryPage">重新加载</button></div>
      <div v-else-if="!currentCategory" class="state-panel"><p>没有找到这个分类</p><RouterLink to="/">返回首页</RouterLink></div>
      <div v-else-if="!goodsList.length" class="state-panel"><p>这个分类暂时还没有商品</p><RouterLink to="/">浏览其他分类</RouterLink></div>
      <div v-else class="goods-list"><GoodsCard v-for="goods in goodsList" :key="goods.id" :goods="goods" /></div>
      <div ref="loadTrigger" v-show="!loading && goodsList.length" class="pagination" role="status" aria-live="polite" :aria-busy="loadingMore">
        <template v-if="loadingMore"><span class="spinner" aria-hidden="true" /><span>正在加载更多商品……</span></template>
        <template v-else-if="errorMessage"><span class="inline-error">{{ errorMessage }}</span><button type="button" @click="loadMore">重新加载</button></template>
        <span v-else-if="hasMore">向下滑动，查看更多商品</span><span v-else>— 已经看到全部商品了 —</span>
      </div>
    </section>
    <footer>© 2026 微商城 · 用心挑选每一件商品</footer>
  </main>
</template>

<style scoped>
.category-page { width: min(1600px, calc(100% - 24px)); margin: 0 auto; color: #24332c; }
.header { display: flex; min-height: 76px; align-items: center; justify-content: space-between; gap: 24px; }
.brand { display: flex; align-items: center; gap: 11px; }.brand-mark { display: grid; width: 40px; height: 40px; place-items: center; border-radius: 12px; color: white; background: #2d6a4f; font: 700 19px Georgia, serif; }.brand strong,.brand small { display: block; }.brand strong { font-size: 18px; letter-spacing: .08em; }.brand small { margin-top: 2px; color: #849189; font-size: 10px; }
.breadcrumb { display: flex; gap: 9px; padding: 13px 2px 17px; color: #87928b; font-size: 13px; }.breadcrumb a:hover { color: #2d6a4f; }.breadcrumb strong { color: #45564c; font-weight: 600; }
.category-hero { display: flex; min-height: 150px; padding: 30px 42px; align-items: center; justify-content: space-between; overflow: hidden; border-radius: 20px; color: white; background: linear-gradient(120deg, #2c654c, #5c8a70); }.category-hero p { margin: 0 0 8px; color: #d9e8de; font-size: 10px; font-weight: 700; letter-spacing: .22em; }.category-hero h1 { margin: 0 0 9px; font-size: 31px; }.category-hero span { color: #e5efe9; font-size: 13px; }.hero-number { margin-right: 18px; color: rgba(255,255,255,.13); font: 700 88px/1 Georgia,serif; }
.subcategories { display: flex; flex-wrap: wrap; gap: 9px; margin: 18px 0 4px; padding: 15px 18px; border: 1px solid #e5ebe7; border-radius: 14px; background: white; }.subcategories a { padding: 7px 14px; border-radius: 999px; color: #657269; font-size: 13px; }.subcategories a:hover,.subcategories a.active { color: white; background: #2d6a4f; }
.goods-section { padding-top: 34px; }.section-heading { display: flex; margin-bottom: 18px; align-items: end; justify-content: space-between; }.section-heading p { margin: 0 0 7px; color: #87948c; font-size: 10px; font-weight: 700; letter-spacing: .2em; }.section-heading h2 { margin: 0; font-size: 25px; }.section-heading > span { color: #919b95; font-size: 12px; }
.goods-list { display: grid; grid-template-columns: repeat(6,minmax(0,1fr)); gap: 14px; }
.state-panel { display: grid; min-height: 260px; place-items: center; align-content: center; gap: 12px; border-radius: 16px; color: #7f8c84; background: white; }.state-panel a,.state-panel button,.pagination button { padding: 9px 18px; border: 0; border-radius: 999px; color: white; background: #2d6a4f; cursor: pointer; }.error-panel,.inline-error { color: #b54d3a; }.spinner { width: 28px; height: 28px; border: 3px solid #dce7df; border-top-color: #2d6a4f; border-radius: 50%; animation: spin .8s linear infinite; }.pagination { display: flex; min-height: 94px; align-items: center; justify-content: center; gap: 12px; color: #718078; font-size: 13px; }footer { margin-top: 30px; padding: 30px 0; color: #96a098; border-top: 1px solid #e1e6e2; text-align: center; font-size: 12px; }@keyframes spin { to { transform: rotate(360deg); } }
@media(max-width:1250px){.goods-list{grid-template-columns:repeat(5,minmax(0,1fr));}}@media(max-width:980px){.goods-list{grid-template-columns:repeat(4,minmax(0,1fr));}}@media(max-width:820px){.goods-list{grid-template-columns:repeat(3,minmax(0,1fr));}}@media(max-width:600px){.category-page{width:calc(100% - 16px)}.header{min-height:68px;gap:8px}.brand small{display:none}.header :deep(.account-nav){gap:10px;font-size:12px}.category-hero{min-height:126px;padding:25px 22px}.hero-number{margin:0;font-size:62px}.goods-list{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.subcategories{padding:11px}.subcategories a{padding:6px 10px}.goods-section{padding-top:26px}}
</style>
