<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { AlbumImage, Goods, GoodsReview } from '../../../shared/api'
import { addCart, createOrder, getGoodsAlbum, getGoodsDetail, getGoodsReviews } from '../api'
import { toAssetURL } from '../config'
import defaultAvatar from '../assets/images/avatar_default.png'
import { sanitizeRichText } from '../utils/sanitize'
import { parseGoodsSpecs } from '../../../shared/goods'
import AddressPicker from '../components/AddressPicker.vue'
import ShopAccountNav from '../components/ShopAccountNav.vue'
import useTokenStore from '../stores/token'

const route = useRoute()
const router = useRouter()
const tokenStore = useTokenStore()

const goods = ref<Goods | null>(null)
const album = ref<AlbumImage[]>([])
const reviews = ref<GoodsReview[]>([])
const activePicture = ref('')
const loading = ref(true)
const errorMessage = ref('')
const quantity = ref(1)
const submitting = ref(false)
const actionMessage = ref('')
const purchaseOpen = ref(false)
const purchaseAction = ref<'cart' | 'buy'>('cart')
const selectedSpec = ref('')
const selectedAddressId = ref<number | null>(null)
watch(() => tokenStore.token, () => {
  purchaseOpen.value = false
  selectedAddressId.value = null
  actionMessage.value = ''
}, { flush: 'sync' })

const pictures = computed(() => {
  const paths = [
    goods.value?.picture,
    ...album.value.map(image => image.picture)
  ].filter((path): path is string =>
    typeof path === 'string' && path.length > 0
  )

  return [...new Set(paths)]
})

const safeDescription = computed(() =>
  sanitizeRichText(goods.value?.description ?? '')
)
const specOptions = computed(() => parseGoodsSpecs(goods.value?.spec ?? ''))

async function loadGoods() {
  const id = Number(route.params.id)

  if (!Number.isInteger(id) || id <= 0) {
    errorMessage.value = '商品编号不正确'
    loading.value = false
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    const [goodsData, albumData, reviewData] = await Promise.all([
      getGoodsDetail(id),
      getGoodsAlbum(id),
      getGoodsReviews(id)
    ])

    goods.value = goodsData
    album.value = albumData
    reviews.value = reviewData
    activePicture.value = goodsData.picture
    selectedSpec.value = parseGoodsSpecs(goodsData.spec)[0]
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error
      ? error.message
      : '商品加载失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

function openPurchase(action: 'cart' | 'buy') {
  if (!tokenStore.token) {
    void router.push({ name: 'login', query: { redirect: route.fullPath } })
    return
  }
  purchaseAction.value = action
  quantity.value = 1
  actionMessage.value = ''
  purchaseOpen.value = true
}

async function submitPurchase() {
  if (!goods.value || submitting.value) return
  const previousToken = tokenStore.token
  tokenStore.syncFromStorage()
  if (previousToken !== tokenStore.token) return
  if (!tokenStore.token) {
    void router.push({ name: 'login', query: { redirect: route.fullPath } })
    return
  }

  if (!Number.isInteger(quantity.value) || quantity.value < 1 || quantity.value > goods.value.stock) {
    actionMessage.value = '购买数量不正确'
    return
  }
  if (!selectedSpec.value) {
    actionMessage.value = '请选择商品规格'
    return
  }
  if (selectedAddressId.value === null) {
    actionMessage.value = '请先选择或新增收货地址'
    return
  }

  submitting.value = true
  actionMessage.value = ''
  try {
    if (purchaseAction.value === 'cart') {
      await addCart({
        goods_id: goods.value.id,
        quantity: quantity.value,
        selected_spec: selectedSpec.value,
        address_id: selectedAddressId.value
      })
      purchaseOpen.value = false
      actionMessage.value = '已加入购物车'
    } else {
      const result = await createOrder({
        direct_item: {
          goods_id: goods.value.id,
          quantity: quantity.value,
          selected_spec: selectedSpec.value
        },
        address_id: selectedAddressId.value
      })
      await router.push({ name: 'order-detail', params: { id: result.id } })
    }
  } catch (error: unknown) {
    actionMessage.value = error instanceof Error ? error.message : '提交失败'
  } finally {
    submitting.value = false
  }
}

onMounted(loadGoods)
</script>

<template>
  <main class="detail-page">
    <header>
      <RouterLink class="brand" to="/">微商城</RouterLink>
      <ShopAccountNav />
    </header>

    <nav class="breadcrumb" aria-label="当前位置"><RouterLink to="/">商城首页</RouterLink><span aria-hidden="true">/</span><span aria-current="page">{{ goods?.name || '商品详情' }}</span></nav>

    <section v-if="loading" class="state-panel">商品加载中……</section>

    <section v-else-if="errorMessage" class="state-panel error-panel">
      <p>{{ errorMessage }}</p>
      <RouterLink to="/">返回商城首页</RouterLink>
    </section>

    <section v-else-if="goods" class="product">
      <div class="gallery">
        <div class="main-picture">
          <img :src="toAssetURL(activePicture)" :alt="goods.name">
        </div>

        <div v-if="pictures.length > 1" class="thumbnails">
          <button
            v-for="picture in pictures"
            :key="picture"
            type="button"
            :class="{ active: activePicture === picture }"
            @click="activePicture = picture"
          >
            <img :src="toAssetURL(picture)" :alt="goods.name">
          </button>
        </div>
      </div>

      <div class="product-info">
        <p class="eyebrow">PRODUCT DETAIL</p>
        <h1>{{ goods.name }}</h1>
        <p class="price"><small>¥</small>{{ goods.price.toFixed(2) }}</p>

        <dl>
          <div>
            <dt>商品规格</dt>
            <dd>{{ goods.spec || '默认规格' }}</dd>
          </div>
          <div>
            <dt>库存状态</dt>
            <dd>{{ goods.stock > 0 ? `现货 ${goods.stock} 件` : '暂时售罄' }}</dd>
          </div>
        </dl>

        <div class="buy-actions">
          <button
            type="button"
            class="secondary"
            :disabled="goods.stock === 0"
            @click="openPurchase('cart')"
          >
            加入购物车
          </button>
          <button
            type="button"
            :disabled="goods.stock === 0"
            @click="openPurchase('buy')"
          >
            {{ goods.stock === 0 ? '暂时售罄' : '立即购买' }}
          </button>
        </div>
        <p v-if="actionMessage" class="action-message">{{ actionMessage }}</p>

        <nav class="product-sections" aria-label="商品内容"><a href="#description">商品详情</a><a href="#reviews">买家评价（{{ reviews.length }}）</a></nav>
      </div>
    </section>

    <section v-if="goods && !loading && !errorMessage" id="description" class="description description-panel">
      <h2>商品详情</h2>
      <div v-if="safeDescription" class="rich-text" v-html="safeDescription" />
      <p v-else>这个商品暂时没有详细介绍。</p>
    </section>

    <section v-if="goods && !loading && !errorMessage" id="reviews" class="reviews-section">
      <div class="reviews-heading"><div><p>BUYER REVIEWS</p><h2>买家评价</h2></div><span>{{ reviews.length }} 条评价</span></div>
      <div v-if="reviews.length === 0" class="no-reviews">暂时还没有评价，完成订单后可以分享购买体验。</div>
      <article v-for="review in reviews" v-else :key="review.id" class="review-item">
        <img :src="review.avatar ? toAssetURL(review.avatar) : defaultAvatar" :alt="review.username">
        <div><div class="review-meta"><strong>{{ review.username }}</strong><span><b v-for="star in 5" :key="star" :class="{ muted: star > review.rating }">★</b></span></div><p>{{ review.content }}</p><small>{{ new Date(review.created_at).toLocaleString('zh-CN') }}</small></div>
      </article>
    </section>

    <div v-if="purchaseOpen && goods" class="modal-backdrop" @click.self="purchaseOpen = false">
      <section class="purchase-modal" role="dialog" aria-modal="true" aria-labelledby="purchase-title">
        <button class="close" type="button" aria-label="关闭" @click="purchaseOpen = false">×</button>
        <h2 id="purchase-title">{{ purchaseAction === 'buy' ? '确认购买' : '加入购物车' }}</h2>
        <div class="modal-product"><img :src="toAssetURL(goods.picture)" :alt="goods.name"><div><strong>{{ goods.name }}</strong><p>¥{{ goods.price.toFixed(2) }}</p></div></div>
        <div class="field"><strong>选择规格</strong><div class="spec-list"><label v-for="spec in specOptions" :key="spec" :class="{ active: selectedSpec === spec }"><input v-model="selectedSpec" type="radio" :value="spec">{{ spec }}</label></div></div>
        <label class="quantity-field"><strong>购买数量</strong><input v-model.number="quantity" type="number" min="1" :max="goods.stock"></label>
        <AddressPicker v-model="selectedAddressId" />
        <p v-if="actionMessage" class="modal-error">{{ actionMessage }}</p>
        <button class="submit-purchase" type="button" :disabled="submitting" @click="submitPurchase">{{ submitting ? '正在提交……' : purchaseAction === 'buy' ? '提交订单' : '确认加入购物车' }}</button>
      </section>
    </div>
  </main>
</template>

<style scoped>
.detail-page { width: min(1120px, calc(100% - 40px)); margin: 0 auto; color: #24332c; }
header { display: flex; min-height: 88px; gap: 16px; flex-wrap: wrap; align-items: center; justify-content: space-between; }
header .brand { color: #2d6a4f; font: 700 22px Georgia, "Microsoft YaHei", serif; }
.breadcrumb { display: flex; gap: 12px; padding: 0 0 22px; font-size: 13px; color: #758278; }.breadcrumb a { flex-shrink: 0; color: #2d6a4f; }.breadcrumb [aria-current] { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.product { display: grid; gap: 64px; padding: 48px; border-radius: 28px; background: white; box-shadow: 0 16px 50px rgba(46, 64, 54, .08); grid-template-columns: minmax(0, 1.05fr) minmax(340px, .95fr); }
.main-picture { overflow: hidden; aspect-ratio: 1; border-radius: 22px; background: #edf1ed; }
.main-picture img { width: 100%; height: 100%; object-fit: cover; }
.thumbnails { display: flex; gap: 10px; margin-top: 14px; overflow-x: auto; }
.thumbnails button { flex: 0 0 68px; width: 68px; height: 68px; padding: 3px; overflow: hidden; border: 2px solid transparent; border-radius: 11px; background: transparent; cursor: pointer; }
.thumbnails button.active { border-color: #2d6a4f; }
.thumbnails img { width: 100%; height: 100%; border-radius: 7px; object-fit: cover; }
.eyebrow { margin: 8px 0 12px; color: #7f9186; font-size: 11px; font-weight: 700; letter-spacing: .2em; }
.product-info h1 { margin: 0; font: 700 clamp(30px, 4vw, 46px)/1.25 Georgia, "Microsoft YaHei", serif; }
.price { margin: 25px 0; color: #cf5d42; font: 700 35px Georgia, serif; }
.price small { margin-right: 4px; font-size: 17px; }
dl { margin: 0; border-top: 1px solid #e7ebe8; }
dl div { display: grid; padding: 17px 0; border-bottom: 1px solid #e7ebe8; grid-template-columns: 95px 1fr; }
dt { color: #8b958f; }
dd { margin: 0; }
.buy-actions { display: flex; gap: 12px; margin-top: 24px; }
.buy-actions button { flex: 1; min-height: 48px; padding: 12px 16px; border: 0; border-radius: 10px; color: white; background: #2d6a4f; cursor: pointer; }
.buy-actions button.secondary { border: 1px solid #2d6a4f; color: #2d6a4f; background: white; }
.buy-actions button:disabled { cursor: not-allowed; opacity: .55; }
.action-message { margin: 10px 0 0; color: #2d6a4f; }
.description { margin-top: 28px; }
.description h2 { font-size: 17px; }
.description p { color: #67756d; line-height: 1.9; white-space: pre-wrap; }
.rich-text { color: #67756d; line-height: 1.9; overflow-wrap: anywhere; }
.rich-text :deep(img) { max-width: 100%; height: auto; }
.rich-text :deep(p) { white-space: normal; }
.rich-text :deep(a) { color: #2d6a4f; text-decoration: underline; }
.product-sections { display: flex; flex-wrap: wrap; gap: 24px; margin-top: 28px; padding-top: 20px; border-top: 1px solid #e7ebe8; color: #617467; font-size: 13px; }
.description-panel { padding: 32px 42px; border-radius: 24px; background: white; scroll-margin-top: 20px; }.description-panel h2 { margin-top: 0; font-size: 24px; }.reviews-section { scroll-margin-top: 20px; }
.detail-page a:focus-visible, .detail-page button:focus-visible { outline: 2px solid #2d6a4f; outline-offset: 3px; }
.state-panel { display: grid; min-height: 450px; place-items: center; align-content: center; border-radius: 28px; color: #7d8982; background: white; }
.reviews-section { margin: 28px 0 55px; padding: 34px 42px; border-radius: 24px; background: white; box-shadow: 0 10px 35px rgba(46,64,54,.06); }.reviews-heading { display: flex; margin-bottom: 20px; align-items: end; justify-content: space-between; }.reviews-heading p { margin: 0 0 7px; color: #86968d; font-size: 10px; font-weight: 700; letter-spacing: .2em; }.reviews-heading h2 { margin: 0; font-size: 24px; }.reviews-heading > span { color: #8a958f; font-size: 13px; }.no-reviews { padding: 35px; border-radius: 14px; color: #89948e; background: #f5f7f5; text-align: center; }.review-item { display: grid; gap: 15px; padding: 20px 0; border-top: 1px solid #edf0ee; grid-template-columns: 45px 1fr; }.review-item > img { width: 45px; height: 45px; border-radius: 50%; object-fit: cover; }.review-meta { display: flex; align-items: center; justify-content: space-between; }.review-meta span { color: #e1a23c; }.review-meta b { font-size: 14px; }.review-meta b.muted { color: #d8deda; }.review-item p { margin: 9px 0; color: #536158; line-height: 1.7; }.review-item small { color: #9aa39e; }
.error-panel { color: #b54d3a; }
.error-panel a { padding: 10px 18px; border-radius: 999px; color: white; background: #2d6a4f; }
.modal-backdrop { position: fixed; z-index: 20; inset: 0; display: grid; padding: 20px; place-items: center; background: rgba(24, 34, 28, .55); }
.purchase-modal { position: relative; width: min(560px, 100%); max-height: calc(100vh - 40px); padding: 28px; overflow-y: auto; border-radius: 20px; background: white; box-shadow: 0 24px 70px rgba(0, 0, 0, .22); }
.purchase-modal > h2 { margin: 0 0 20px; }.close { position: absolute; top: 16px; right: 18px; border: 0; color: #718078; background: none; font-size: 27px; cursor: pointer; }.modal-product { display: flex; gap: 14px; padding: 12px; align-items: center; border-radius: 12px; background: #f4f7f5; }.modal-product img { width: 66px; height: 66px; border-radius: 9px; object-fit: cover; }.modal-product p { margin: 7px 0 0; color: #cf5d42; }.field, .quantity-field { display: grid; gap: 10px; margin: 18px 0; }.spec-list { display: flex; gap: 9px; flex-wrap: wrap; }.spec-list label { padding: 8px 13px; border: 1px solid #d5ddd8; border-radius: 8px; cursor: pointer; }.spec-list label.active { border-color: #2d6a4f; color: #2d6a4f; background: #f1f7f3; }.spec-list input { position: absolute; opacity: 0; }.quantity-field input { width: 100px; padding: 9px; border: 1px solid #d5ddd8; border-radius: 8px; }.modal-error { color: #b54d3a; }.submit-purchase { width: 100%; margin-top: 16px; padding: 12px; border: 0; border-radius: 10px; color: white; background: #2d6a4f; cursor: pointer; }.submit-purchase:disabled { opacity: .55; }
@media (max-width: 800px) { .product { gap: 35px; padding: 24px; grid-template-columns: 1fr; } }
@media (max-width: 520px) { .detail-page { width: min(100% - 24px, 1120px); } .product { border-radius: 20px; }.description-panel, .reviews-section { padding: 24px; } }
</style>
