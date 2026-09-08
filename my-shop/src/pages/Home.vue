<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type { Category, CursorPageResult, Goods } from '../../../shared/api'
import { getCategories, getGoodsList } from '../api'
import { toAssetURL } from '../config'
import ShopAccountNav from '../components/ShopAccountNav.vue'

const PAGE_SIZE = 8

const categories = ref<Category[]>([])
const goodsList = ref<Goods[]>([])
const selectedCategoryId = ref(0)
const hasMore = ref(false)
const nextLastId = ref(0)
const loading = ref(true)
const loadingMore = ref(false)
const errorMessage = ref('')
const loadTrigger = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null
let disposed = false

// 每次渲染后重新观察列表底部，首批不足一屏时也能继续补齐。
async function observeListEnd() {
  await nextTick()
  if (disposed || !observer) return
  observer.disconnect()
  if (!loading.value && !loadingMore.value && !errorMessage.value && hasMore.value && goodsList.value.length && loadTrigger.value) {
    observer.observe(loadTrigger.value)
  }
}
watch([loading, loadingMore, hasMore, errorMessage], observeListEnd)

const rootCategories = computed(() =>
  categories.value.filter(category => category.pid === 0)
)

const selectedCategoryTitle = computed(() => {
  if (selectedCategoryId.value === 0) return '全部商品'

  return rootCategories.value.find(
    category => category.id === selectedCategoryId.value
  )?.name ?? '商品'
})

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '数据加载失败，请稍后重试'
}

function applyGoodsPage(data: CursorPageResult<Goods>, append: boolean) {
  goodsList.value = append
    ? [...goodsList.value, ...data.list]
    : data.list
  hasMore.value = data.hasMore
  nextLastId.value = data.nextLastId
}

async function loadHomeData() {
  loading.value = true
  errorMessage.value = ''

  try {
    const [categoryData, goodsData] = await Promise.all([
      getCategories(),
      getGoodsList({ last_id: 0, pagesize: PAGE_SIZE })
    ])

    categories.value = categoryData
    selectedCategoryId.value = 0
    applyGoodsPage(goodsData, false)
  } catch (error: unknown) {
    errorMessage.value = getErrorMessage(error)
  } finally {
    loading.value = false
  }
}

async function selectCategory(categoryId: number) {
  if (
    loading.value ||
    loadingMore.value ||
    categoryId === selectedCategoryId.value
  ) return

  selectedCategoryId.value = categoryId
  loading.value = true
  errorMessage.value = ''

  try {
    const data = await getGoodsList({
      last_id: 0,
      pagesize: PAGE_SIZE,
      category_id: categoryId
    })
    applyGoodsPage(data, false)
  } catch (error: unknown) {
    goodsList.value = []
    errorMessage.value = getErrorMessage(error)
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (loading.value || loadingMore.value || !hasMore.value) return

  loadingMore.value = true
  errorMessage.value = ''

  try {
    const data = await getGoodsList({
      last_id: nextLastId.value,
      pagesize: PAGE_SIZE,
      category_id: selectedCategoryId.value
    })
    if (data.hasMore && (!data.list.length || data.nextLastId === nextLastId.value)) {
      throw new Error('商品加载暂时异常，请重试')
    }
    applyGoodsPage(data, true)
  } catch (error: unknown) {
    errorMessage.value = getErrorMessage(error)
  } finally {
    loadingMore.value = false
  }
}

onMounted(() => {
  observer = new IntersectionObserver(entries => {
    if (!disposed && !errorMessage.value && entries.some(entry => entry.isIntersecting)) void loadMore()
  }, { rootMargin: '0px 0px 240px 0px' })
  void loadHomeData()
})
onUnmounted(() => { disposed = true; observer?.disconnect(); observer = null })
</script>

<template>
  <main class="home">
    <header class="header">
      <RouterLink class="brand" to="/">
        <span class="brand-mark">微</span>
        <span>
          <strong>微商城</strong>
          <small>简单、安心地选购好物</small>
        </span>
      </RouterLink>

      <ShopAccountNav />
    </header>

    <section class="hero">
      <div>
        <p class="eyebrow">WELCOME TO OUR SHOP</p>
        <h1>发现日常生活里的<br><em>新鲜好物</em></h1>
        <p>精选商品，清晰分类，让每一次浏览都轻松自然。</p>
        <a href="#goods">开始选购</a>
      </div>
      <div class="hero-art" aria-hidden="true"><span>SHOP</span></div>
    </section>

    <section class="category-section" aria-labelledby="category-title">
      <div class="section-heading">
        <div>
          <p>EXPLORE</p>
          <h2 id="category-title">按分类浏览</h2>
        </div>
      </div>

      <div class="category-list">
        <button
          type="button"
          class="category-item"
          :class="{ active: selectedCategoryId === 0 }"
          :disabled="loading"
          @click="selectCategory(0)"
        >
          <span class="category-icon">全</span>
          <span>全部商品</span>
        </button>

        <button
          v-for="category in rootCategories"
          :key="category.id"
          type="button"
          class="category-item"
          :class="{ active: selectedCategoryId === category.id }"
          :disabled="loading"
          @click="selectCategory(category.id)"
        >
          <img :src="toAssetURL(category.picture)" :alt="category.name">
          <span>{{ category.name }}</span>
        </button>
      </div>
    </section>

    <section id="goods" class="goods-section" aria-labelledby="goods-title">
      <div class="section-heading">
        <div>
          <p>OUR PRODUCTS</p>
          <h2 id="goods-title">{{ selectedCategoryTitle }}</h2>
        </div>
        <span v-if="goodsList.length">已展示 {{ goodsList.length }} 件</span>
      </div>

      <div v-if="loading" class="state-panel">
        <span class="spinner" aria-hidden="true" />
        <p>正在为你挑选商品……</p>
      </div>

      <div
        v-else-if="errorMessage && goodsList.length === 0"
        class="state-panel error-panel"
      >
        <p>{{ errorMessage }}</p>
        <button type="button" @click="loadHomeData">重新加载</button>
      </div>

      <div v-else-if="goodsList.length === 0" class="state-panel">
        <p>这个分类暂时还没有商品</p>
      </div>

      <div v-else class="goods-list">
        <RouterLink
          v-for="goods in goodsList"
          :key="goods.id"
          class="goods-card"
          :to="{ name: 'goods-detail', params: { id: goods.id } }"
          target="_blank"
          rel="noopener"
          title="在新标签页查看商品详情"
        >
          <div class="goods-picture">
            <img :src="toAssetURL(goods.picture)" :alt="goods.name">
            <span v-if="goods.stock === 0" class="sold-out">暂时售罄</span>
          </div>

          <div class="goods-content">
            <h3>{{ goods.name }}</h3>
            <p>{{ goods.spec || '品质好物，值得选择' }}</p>
            <div class="goods-footer">
              <strong><small>¥</small>{{ goods.price.toFixed(2) }}</strong>
              <span>库存 {{ goods.stock }}</span>
            </div>
          </div>
        </RouterLink>
      </div>

      <div ref="loadTrigger" v-show="!loading && goodsList.length" class="pagination" role="status" aria-live="polite" :aria-busy="loadingMore">
        <template v-if="loadingMore"><span class="spinner" aria-hidden="true" /><span>正在加载更多商品……</span></template>
        <template v-else-if="errorMessage"><span class="inline-error">{{ errorMessage }}</span><button type="button" @click="loadMore">重新加载</button></template>
        <span v-else-if="hasMore">向下滑动，发现更多好物</span>
        <span v-else>— 已经看到全部商品了 —</span>
      </div>
    </section>

    <footer>© 2026 微商城 · 用心挑选每一件商品</footer>
  </main>
</template>

<style scoped>
.home { width: min(1180px, calc(100% - 40px)); margin: 0 auto; color: #24332c; }
.header { display: flex; min-height: 88px; align-items: center; justify-content: space-between; gap: 24px; }
.brand { display: flex; align-items: center; gap: 12px; }
.brand-mark { display: grid; width: 44px; height: 44px; place-items: center; border-radius: 14px; color: white; background: #2d6a4f; font: 700 21px Georgia, serif; }
.brand strong, .brand small { display: block; }
.brand strong { font-size: 19px; letter-spacing: .08em; }
.brand small { margin-top: 3px; color: #849189; font-size: 11px; }
.account-links { display: flex; align-items: center; gap: 22px; font-size: 14px; }
.account-links a:hover { color: #2d6a4f; }
.profile-link { padding: 9px 16px; border: 1px solid #2d6a4f; border-radius: 999px; color: #2d6a4f; }
.hero { display: grid; min-height: 410px; padding: 58px 64px; align-items: center; grid-template-columns: 1.15fr .85fr; overflow: hidden; border-radius: 30px; background: linear-gradient(135deg, #eaf4ed 0%, #f8f1df 100%); }
.eyebrow, .section-heading p { margin: 0 0 10px; color: #7a8e80; font-size: 11px; font-weight: 700; letter-spacing: .22em; }
.hero h1 { margin: 0; font: 700 clamp(38px, 5vw, 64px)/1.15 Georgia, "Microsoft YaHei", serif; }
.hero h1 em { color: #2d6a4f; font-style: normal; }
.hero p:not(.eyebrow) { max-width: 500px; margin: 24px 0 30px; color: #68766e; line-height: 1.8; }
.hero a, .pagination button, .state-panel button { display: inline-block; padding: 12px 24px; border: 0; border-radius: 999px; color: white; background: #2d6a4f; cursor: pointer; }
.hero-art { position: relative; display: grid; width: 290px; height: 290px; margin: auto; place-items: center; border: 1px solid rgba(45, 106, 79, .16); border-radius: 50%; background: rgba(255, 255, 255, .48); box-shadow: inset 0 0 0 34px rgba(255,255,255,.24); }
.hero-art::before, .hero-art::after { position: absolute; content: ""; border-radius: 50% 10% 50% 10%; background: #80a98e; transform: rotate(32deg); }
.hero-art::before { width: 86px; height: 160px; top: 12px; right: 4px; }
.hero-art::after { width: 64px; height: 120px; bottom: 6px; left: 12px; transform: rotate(-48deg); }
.hero-art span { z-index: 1; color: #2d6a4f; font: 700 38px Georgia, serif; letter-spacing: .12em; }
.category-section, .goods-section { padding-top: 64px; }
.section-heading { display: flex; margin-bottom: 25px; align-items: end; justify-content: space-between; gap: 20px; }
.section-heading h2 { margin: 0; font: 700 30px Georgia, "Microsoft YaHei", serif; }
.section-heading > span { color: #849189; font-size: 13px; }
.category-list { display: flex; gap: 14px; padding: 4px 2px 12px; overflow-x: auto; }
.category-item { display: grid; flex: 0 0 112px; gap: 10px; justify-items: center; padding: 14px 8px; border: 1px solid transparent; border-radius: 18px; color: #526158; background: transparent; cursor: pointer; transition: .2s ease; }
.category-item:hover, .category-item.active { border-color: #b8cfbf; color: #2d6a4f; background: white; box-shadow: 0 10px 24px rgba(42, 75, 58, .08); transform: translateY(-2px); }
.category-item:disabled { cursor: wait; }
.category-item img, .category-icon { display: grid; width: 68px; height: 68px; place-items: center; border-radius: 50%; object-fit: cover; background: #dcecdf; color: #2d6a4f; font-size: 22px; font-weight: 700; }
.goods-list { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 22px; }
.goods-card { overflow: hidden; border-radius: 20px; background: white; box-shadow: 0 7px 30px rgba(46, 64, 54, .07); transition: transform .2s ease, box-shadow .2s ease; }
.goods-card:hover { box-shadow: 0 16px 38px rgba(46, 64, 54, .14); transform: translateY(-5px); }
.goods-picture { position: relative; aspect-ratio: 1 / .82; overflow: hidden; background: #eef1ee; }
.goods-picture img { width: 100%; height: 100%; object-fit: cover; transition: transform .35s ease; }
.goods-card:hover img { transform: scale(1.04); }
.sold-out { position: absolute; top: 12px; right: 12px; padding: 5px 9px; border-radius: 999px; color: white; background: rgba(38, 44, 40, .76); font-size: 12px; }
.goods-content { padding: 18px; }
.goods-content h3 { margin: 0; overflow: hidden; font-size: 17px; text-overflow: ellipsis; white-space: nowrap; }
.goods-content > p { min-height: 20px; margin: 9px 0 17px; overflow: hidden; color: #849189; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.goods-footer { display: flex; align-items: end; justify-content: space-between; }
.goods-footer strong { color: #cf5d42; font: 700 20px Georgia, serif; }
.goods-footer strong small { margin-right: 2px; font-size: 13px; }
.goods-footer span { color: #98a099; font-size: 12px; }
.state-panel { display: grid; min-height: 230px; place-items: center; align-content: center; color: #7f8c84; border-radius: 20px; background: white; }
.spinner { width: 30px; height: 30px; border: 3px solid #dce7df; border-top-color: #2d6a4f; border-radius: 50%; animation: spin .8s linear infinite; }
.error-panel { color: #b54d3a; }
.inline-error { color: #b54d3a; text-align: center; }
.pagination { display: flex; flex-wrap: wrap; gap: 12px; min-height: 100px; align-items: center; justify-content: center; color: #718078; font-size: 13px; }
.pagination button:disabled { cursor: wait; opacity: .65; }
footer { margin-top: 40px; padding: 34px 0; color: #96a098; border-top: 1px solid #e1e6e2; text-align: center; font-size: 12px; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 900px) { .goods-list { grid-template-columns: repeat(2, minmax(0, 1fr)); } .hero { padding: 45px; grid-template-columns: 1fr; } .hero-art { display: none; } }
@media (max-width: 560px) { .home { width: min(100% - 24px, 1180px); } .header { align-items: flex-start; } .brand small, .account-links > a:not(.profile-link) { display: none; } .hero { min-height: 340px; padding: 34px 25px; border-radius: 22px; } .hero h1 { font-size: 38px; } .category-section, .goods-section { padding-top: 45px; } .goods-list { grid-template-columns: 1fr 1fr; gap: 12px; } .goods-content { padding: 13px; } .goods-picture { aspect-ratio: 1; } }
</style>
