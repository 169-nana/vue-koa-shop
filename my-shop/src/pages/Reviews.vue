<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import type { ReviewableItem } from '../../../shared/api'
import { createReview, getReviewableItems } from '../api'
import { toAssetURL } from '../config'

interface ReviewForm { rating: number; content: string; submitting: boolean; error: string }
const items = ref<ReviewableItem[]>([])
const forms = reactive<Record<number, ReviewForm>>({})
const loading = ref(true)
const errorMessage = ref('')

async function loadItems() {
  loading.value = true
  errorMessage.value = ''
  try {
    items.value = await getReviewableItems()
    for (const item of items.value) forms[item.order_item_id] = { rating: 5, content: '', submitting: false, error: '' }
  } catch (error: unknown) { errorMessage.value = error instanceof Error ? error.message : '待评价商品加载失败' }
  finally { loading.value = false }
}

async function submit(item: ReviewableItem) {
  const form = forms[item.order_item_id]
  if (!form || form.submitting) return
  const content = form.content.trim()
  if (content.length < 2 || content.length > 1000) { form.error = '评价内容必须是2到1000个字符'; return }
  form.submitting = true
  form.error = ''
  try {
    await createReview({ order_item_id: item.order_item_id, rating: form.rating, content })
    items.value = items.value.filter(current => current.order_item_id !== item.order_item_id)
    delete forms[item.order_item_id]
  } catch (error: unknown) { form.error = error instanceof Error ? error.message : '评价提交失败' }
  finally { if (forms[item.order_item_id]) forms[item.order_item_id].submitting = false }
}

onMounted(loadItems)
</script>

<template>
  <main class="page-shell">
    <header><RouterLink class="brand" to="/">微商城</RouterLink><nav><RouterLink to="/orders">我的订单</RouterLink><RouterLink to="/profile">个人中心</RouterLink></nav></header>
    <div class="title"><p>PRODUCT REVIEWS</p><h1>评价已购商品</h1><span>完成的订单会出现在这里，每件商品只能评价一次</span></div>
    <section v-if="loading" class="state">待评价商品加载中……</section>
    <section v-else-if="errorMessage" class="state error"><p>{{ errorMessage }}</p><button @click="loadItems">重新加载</button></section>
    <section v-else-if="items.length === 0" class="state"><h2>没有待评价商品</h2><p>已完成订单中的商品评价后会从这里移除。</p><RouterLink to="/orders">查看我的订单</RouterLink></section>
    <section v-else class="review-list">
      <article v-for="item in items" :key="item.order_item_id" class="review-card">
        <RouterLink :to="{ name: 'goods-detail', params: { id: item.goods_id } }"><img :src="toAssetURL(item.goods_picture)" :alt="item.goods_name"></RouterLink>
        <div class="review-content"><h2>{{ item.goods_name }}</h2><p class="spec">{{ item.goods_spec || '默认规格' }}</p>
          <div v-if="forms[item.order_item_id]" class="form">
            <div class="rating"><span>商品评分</span><button v-for="star in 5" :key="star" type="button" :class="{ active: star <= forms[item.order_item_id].rating }" :aria-label="`${star}星`" @click="forms[item.order_item_id].rating = star">★</button><b>{{ forms[item.order_item_id].rating }}.0</b></div>
            <textarea v-model="forms[item.order_item_id].content" maxlength="1000" rows="4" placeholder="商品质量怎么样？把真实体验分享给大家吧" />
            <p v-if="forms[item.order_item_id].error" class="item-error">{{ forms[item.order_item_id].error }}</p>
            <div class="submit-row"><small>{{ forms[item.order_item_id].content.trim().length }}/1000</small><button type="button" :disabled="forms[item.order_item_id].submitting" @click="submit(item)">{{ forms[item.order_item_id].submitting ? '提交中……' : '发布评价' }}</button></div>
          </div>
        </div>
      </article>
    </section>
  </main>
</template>

<style scoped>
.page-shell{width:min(920px,calc(100% - 40px));margin:0 auto 60px;color:#26352d}header{display:flex;min-height:88px;align-items:center;justify-content:space-between}.brand{color:#2d6a4f;font:700 23px Georgia,"Microsoft YaHei",serif}nav{display:flex;gap:20px;color:#68766e;font-size:14px}.title{margin:30px 0 25px}.title>p{margin:0 0 8px;color:#829087;font-size:10px;font-weight:700;letter-spacing:.2em}.title h1{margin:0 0 10px;font:700 38px Georgia,"Microsoft YaHei",serif}.title span{color:#87938c;font-size:13px}.state{display:grid;min-height:350px;padding:25px;place-items:center;align-content:center;border-radius:22px;background:#fff;text-align:center}.state p{color:#849088}.state a,.state button{padding:10px 19px;border:0;border-radius:999px;color:#fff;background:#2d6a4f;cursor:pointer}.state.error,.item-error{color:#b54d3a}.review-list{display:grid;gap:18px}.review-card{display:grid;gap:24px;padding:25px;border-radius:21px;background:#fff;box-shadow:0 8px 27px rgba(46,64,54,.06);grid-template-columns:130px 1fr}.review-card>a img{width:130px;height:130px;border-radius:15px;object-fit:cover}.review-content h2{margin:3px 0 7px;font-size:19px}.spec{margin:0 0 19px;color:#89948e;font-size:13px}.rating{display:flex;margin-bottom:13px;align-items:center}.rating>span{margin-right:13px;color:#69776f;font-size:13px}.rating button{padding:0 2px;border:0;color:#d7ddd9;background:none;font-size:24px;cursor:pointer}.rating button.active{color:#e4a744}.rating b{margin-left:9px;color:#ca7c31}.form textarea{width:100%;padding:13px;resize:vertical;border:1px solid #d6ded9;border-radius:10px;font:inherit}.item-error{margin:8px 0}.submit-row{display:flex;margin-top:10px;align-items:center;justify-content:space-between}.submit-row small{color:#929d97}.submit-row button{padding:9px 19px;border:0;border-radius:999px;color:#fff;background:#2d6a4f;cursor:pointer}.submit-row button:disabled{opacity:.55}@media(max-width:620px){.review-card{grid-template-columns:1fr}.review-card>a img{width:90px;height:90px}}
</style>
