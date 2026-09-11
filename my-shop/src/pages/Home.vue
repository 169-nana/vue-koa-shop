<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type { Category, CursorPageResult, Goods } from '../../../shared/api'
import { getCategories, getGoodsList } from '../api'
import GoodsCard from '../components/GoodsCard.vue'
import ShopAccountNav from '../components/ShopAccountNav.vue'

const PAGE_SIZE = 20
const categories = ref<Category[]>([])
const goodsList = ref<Goods[]>([])
const activeRootId = ref(0)
const hasMore = ref(false)
const nextLastId = ref(0)
const loading = ref(true)
const loadingMore = ref(false)
const errorMessage = ref('')
const loadTrigger = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null
let disposed = false

const rootCategories = computed(() => categories.value.filter(category => category.pid === 0))
const activeRoot = computed(() => rootCategories.value.find(category => category.id === activeRootId.value) ?? rootCategories.value[0] ?? null)
const activeChildren = computed(() => activeRoot.value ? categories.value.filter(category => category.pid === activeRoot.value?.id) : [])

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
async function loadHomeData() {
  loading.value = true
  errorMessage.value = ''
  try {
    const [categoryData, goodsData] = await Promise.all([getCategories(), getGoodsList({ last_id: 0, pagesize: PAGE_SIZE })])
    categories.value = categoryData
    activeRootId.value = rootCategories.value[0]?.id ?? 0
    applyGoodsPage(goodsData, false)
  } catch (error: unknown) { errorMessage.value = getErrorMessage(error) } finally { loading.value = false }
}
async function loadMore() {
  if (loading.value || loadingMore.value || !hasMore.value) return
  loadingMore.value = true
  errorMessage.value = ''
  try {
    const data = await getGoodsList({ last_id: nextLastId.value, pagesize: PAGE_SIZE })
    if (data.hasMore && (!data.list.length || data.nextLastId === nextLastId.value)) throw new Error('商品加载暂时异常，请重试')
    applyGoodsPage(data, true)
  } catch (error: unknown) { errorMessage.value = getErrorMessage(error) } finally { loadingMore.value = false }
}
onMounted(() => {
  observer = new IntersectionObserver(entries => { if (!disposed && !errorMessage.value && entries.some(entry => entry.isIntersecting)) void loadMore() }, { rootMargin: '0px 0px 240px 0px' })
  void loadHomeData()
})
onUnmounted(() => { disposed = true; observer?.disconnect(); observer = null })
</script>

<template>
  <main class="home">
    <header class="header">
      <RouterLink class="brand" to="/"><span class="brand-mark">微</span><span><strong>微商城</strong><small>简单、安心地选购好物</small></span></RouterLink>
      <ShopAccountNav />
    </header>

    <section class="catalog-stage" aria-label="商品分类导航">
      <nav class="category-menu" aria-label="一级分类">
        <div class="category-title"><span>☰</span><strong>全部商品分类</strong></div>
        <RouterLink v-for="category in rootCategories" :key="category.id" class="root-category" :class="{ active: activeRoot?.id === category.id }" :to="{ name: 'category-goods', params: { id: category.id } }" @mouseenter="activeRootId = category.id" @focus="activeRootId = category.id">
          <span>{{ category.name }}</span><b aria-hidden="true">›</b>
        </RouterLink>
      </nav>

      <div class="category-detail">
        <div v-if="activeRoot" class="detail-content">
          <p>EXPLORE CATEGORY</p>
          <span class="detail-label">一级分类</span>
          <RouterLink class="detail-title" :to="{ name: 'category-goods', params: { id: activeRoot.id } }"><span>{{ activeRoot.name }}</span><small>查看全部 ›</small></RouterLink>
          <span class="detail-label child-label">二级分类</span>
          <div v-if="activeChildren.length" class="child-list">
            <RouterLink v-for="child in activeChildren" :key="child.id" :to="{ name: 'category-goods', params: { id: child.id } }">{{ child.name }}</RouterLink>
          </div>
          <div v-else class="empty-children">该分类下暂时没有更多子分类</div>
        </div>
        <div class="category-decoration" aria-hidden="true"><span>{{ activeRoot?.name.slice(0, 1) || '选' }}</span></div>
      </div>

      <div class="hero-copy">
        <p class="eyebrow">WELCOME TO OUR SHOP</p>
        <h1>发现日常生活里的<br><em>新鲜好物</em></h1>
        <p class="hero-description">分类更清晰，商品更紧凑，让你更快找到真正需要的好物。</p>
        <a href="#goods">开始选购</a>
      </div>
    </section>

    <section id="goods" class="goods-section" aria-labelledby="goods-title">
      <div class="section-heading"><div><p>RECOMMENDED</p><h2 id="goods-title">精选商品</h2></div><span v-if="goodsList.length">已展示 {{ goodsList.length }} 件</span></div>
      <div v-if="loading" class="state-panel"><span class="spinner" aria-hidden="true" /><p>正在为你挑选商品……</p></div>
      <div v-else-if="errorMessage && !goodsList.length" class="state-panel error-panel"><p>{{ errorMessage }}</p><button type="button" @click="loadHomeData">重新加载</button></div>
      <div v-else-if="!goodsList.length" class="state-panel"><p>暂时还没有上架商品</p></div>
      <div v-else class="goods-list"><GoodsCard v-for="goods in goodsList" :key="goods.id" :goods="goods" /></div>
      <div ref="loadTrigger" v-show="!loading && goodsList.length" class="pagination" role="status" aria-live="polite" :aria-busy="loadingMore">
        <template v-if="loadingMore"><span class="spinner" aria-hidden="true" /><span>正在加载更多商品……</span></template>
        <template v-else-if="errorMessage"><span class="inline-error">{{ errorMessage }}</span><button type="button" @click="loadMore">重新加载</button></template>
        <span v-else-if="hasMore">向下滑动，发现更多好物</span><span v-else>— 已经看到全部商品了 —</span>
      </div>
    </section>
    <footer>© 2026 微商城 · 用心挑选每一件商品</footer>
  </main>
</template>

<style scoped>
.home { width: min(1600px, calc(100% - 24px)); margin: 0 auto; color: #24332c; }.header { display:flex;min-height:76px;align-items:center;justify-content:space-between;gap:18px}.brand{display:flex;flex:0 0 auto;align-items:center;gap:11px}.brand-mark{display:grid;width:40px;height:40px;place-items:center;border-radius:12px;color:white;background:#2d6a4f;font:700 19px Georgia,serif}.brand strong,.brand small{display:block;white-space:nowrap}.brand strong{font-size:18px;letter-spacing:.08em}.brand small{margin-top:2px;color:#849189;font-size:10px}
.catalog-stage { position: relative; display: grid; min-height: 392px; grid-template-columns: 218px 1fr; overflow: hidden; border-radius: 18px; background: linear-gradient(125deg,#edf6ef 0%,#f8f1df 100%); }.category-menu { z-index: 3; padding: 0 10px 12px; overflow-y: auto; color: #f3f7f4; background: #263d31; }.category-title { display: flex; height: 48px; padding: 0 9px; align-items: center; gap: 10px; border-bottom: 1px solid rgba(255,255,255,.12); font-size: 14px; }.category-title span{font-size:16px}.root-category { display:flex;height:40px;padding:0 10px;align-items:center;justify-content:space-between;border-radius:7px;color:#dbe5de;font-size:13px;transition:.15s ease}.root-category b{font-size:19px;font-weight:400;color:#91a49a}.root-category:hover,.root-category:focus,.root-category.active{color:#263d31;background:#f5f8f5}.root-category:hover b,.root-category:focus b,.root-category.active b{color:#2d6a4f}
.category-detail { position: absolute; z-index: 4; top: 0; bottom: 0; left: 218px; display: none; width: min(680px, calc(100% - 218px)); padding: 36px 38px; overflow: hidden; border: 1px solid #dbe7df; background: rgba(255,255,255,.99); box-shadow: 18px 0 40px rgba(33,58,43,.13); }.catalog-stage:has(.category-menu:hover) .category-detail,.catalog-stage:has(.category-menu:focus-within) .category-detail,.category-detail:hover{display:block}.detail-content{position:relative;z-index:2;max-width:500px}.detail-content>p{margin:0 0 24px;color:#8ba095;font-size:10px;font-weight:700;letter-spacing:.2em}.detail-label{display:block;margin-bottom:7px;color:#9aa49e;font-size:11px}.child-label{margin-top:24px}.detail-title{display:flex;padding-bottom:15px;align-items:end;justify-content:space-between;border-bottom:1px solid #e5ece7}.detail-title span{font-size:26px;font-weight:700}.detail-title small{color:#2d6a4f;font-size:12px}.child-list{display:flex;flex-wrap:wrap;gap:10px;margin-top:0}.child-list a{padding:8px 14px;border-radius:7px;color:#52645a;background:#f1f5f2;font-size:13px}.child-list a:hover{color:white;background:#2d6a4f}.empty-children{margin-top:0;color:#95a099;font-size:13px}.category-decoration{position:absolute;right:-50px;bottom:-60px;display:grid;width:250px;height:250px;place-items:center;border-radius:50%;color:rgba(45,106,79,.12);background:#edf5ef;font:700 100px Georgia,serif}
.hero-copy { display:flex;min-width:0;padding:48px 8% 48px 10%;align-items:flex-start;justify-content:center;flex-direction:column }.eyebrow,.section-heading p{margin:0 0 9px;color:#7a8e80;font-size:10px;font-weight:700;letter-spacing:.22em}.hero-copy h1{margin:0;font:700 clamp(35px,4.2vw,57px)/1.16 Georgia,"Microsoft YaHei",serif}.hero-copy h1 em{color:#2d6a4f;font-style:normal}.hero-description{max-width:510px;margin:18px 0 24px;color:#68766e;line-height:1.7}.hero-copy>a,.pagination button,.state-panel button{display:inline-block;padding:10px 21px;border:0;border-radius:999px;color:white;background:#2d6a4f;cursor:pointer}
.goods-section{padding-top:36px}.section-heading{display:flex;margin-bottom:17px;align-items:end;justify-content:space-between;gap:20px}.section-heading h2{margin:0;font-size:26px}.section-heading>span{color:#849189;font-size:12px}.goods-list{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:14px}.state-panel{display:grid;min-height:230px;place-items:center;align-content:center;gap:12px;color:#7f8c84;border-radius:16px;background:white}.spinner{width:28px;height:28px;border:3px solid #dce7df;border-top-color:#2d6a4f;border-radius:50%;animation:spin .8s linear infinite}.error-panel,.inline-error{color:#b54d3a}.pagination{display:flex;flex-wrap:wrap;gap:12px;min-height:94px;align-items:center;justify-content:center;color:#718078;font-size:13px}footer{margin-top:30px;padding:30px 0;color:#96a098;border-top:1px solid #e1e6e2;text-align:center;font-size:12px}@keyframes spin{to{transform:rotate(360deg)}}
@media(max-width:1250px){.goods-list{grid-template-columns:repeat(5,minmax(0,1fr))}}@media(max-width:980px){.goods-list{grid-template-columns:repeat(4,minmax(0,1fr))}}@media(max-width:820px){.catalog-stage{grid-template-columns:170px 1fr}.category-detail{left:170px;width:calc(100% - 170px)}.hero-copy{padding-left:7%}.goods-list{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:650px){.home{width:calc(100% - 16px)}.header{min-height:68px;gap:8px}.brand-mark{width:34px;height:34px;border-radius:10px;font-size:16px}.brand strong{font-size:15px}.brand small{display:none}.header :deep(.account-nav){gap:10px;font-size:12px}.catalog-stage{min-height:310px;grid-template-columns:118px 1fr;border-radius:13px}.category-menu{padding:6px}.category-title{height:38px;padding:0 6px;font-size:11px}.category-title span{display:none}.root-category{height:33px;padding:0 7px;font-size:11px}.root-category b{font-size:15px}.category-detail{left:118px;width:calc(100% - 118px);padding:22px 16px}.detail-content>p{margin-bottom:15px}.detail-title span{font-size:20px}.detail-title{align-items:center}.detail-title small{font-size:10px}.child-label{margin-top:17px}.child-list{gap:7px}.child-list a{padding:6px 9px;font-size:11px}.category-decoration{display:none}.hero-copy{padding:28px 15px}.hero-copy h1{font-size:25px}.hero-description{margin:13px 0 18px;font-size:12px}.hero-copy>a{padding:8px 15px;font-size:12px}.eyebrow{display:none}.goods-section{padding-top:27px}.goods-list{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}}
</style>
