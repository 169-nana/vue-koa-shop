<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { CartItem } from '../../../shared/api'
import { createOrder, getCart } from '../api'
import { toAssetURL } from '../config'
import AddressPicker from '../components/AddressPicker.vue'

const route = useRoute()
const router = useRouter()
const items = ref<CartItem[]>([])
const selectedAddressId = ref<number | null>(null)
const loading = ref(true)
const submitting = ref(false)
const checkoutBlocked = ref(false)
const errorMessage = ref('')

const cartItemIds = computed(() => {
  const value = route.query.cartIds
  if (typeof value !== 'string') return []
  return [...new Set(value.split(',').map(Number).filter(id => Number.isInteger(id) && id > 0))]
})
const totalAmount = computed(() =>
  items.value.reduce((total, item) => total + item.price * item.quantity, 0)
)

async function loadItems() {
  if (cartItemIds.value.length === 0) {
    errorMessage.value = '没有选择需要结算的商品'
    checkoutBlocked.value = true
    loading.value = false
    return
  }
  try {
    const cart = await getCart()
    items.value = cart.filter(item => cartItemIds.value.includes(item.id))
    const savedAddressId = items.value[0]?.address_id ?? null
    if (savedAddressId !== null && items.value.every(item => item.address_id === savedAddressId)) {
      selectedAddressId.value = savedAddressId
    }
    if (items.value.length !== cartItemIds.value.length) {
      errorMessage.value = '部分购物车商品已失效，请返回购物车重新选择'
      checkoutBlocked.value = true
    } else if (items.value.some(item => item.stock === 0 || item.quantity > item.stock)) {
      errorMessage.value = '部分商品库存不足，请返回购物车修改数量'
      checkoutBlocked.value = true
    }
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : '结算信息加载失败'
    checkoutBlocked.value = true
  } finally {
    loading.value = false
  }
}

async function submit() {
  if (loading.value || submitting.value || checkoutBlocked.value || !items.value.length) return
  errorMessage.value = ''
  if (selectedAddressId.value === null) { errorMessage.value = '请选择或新增收货地址'; return }

  submitting.value = true
  try {
    const result = await createOrder({ cart_item_ids: cartItemIds.value, address_id: selectedAddressId.value })
    await router.replace({ name: 'order-detail', params: { id: result.id } })
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : '订单创建失败'
  } finally {
    submitting.value = false
  }
}

onMounted(loadItems)
</script>

<template>
  <main class="page-shell">
    <header><RouterLink class="brand" to="/">微商城</RouterLink><RouterLink to="/cart">返回购物车</RouterLink></header>
    <h1>确认订单</h1>
    <section v-if="loading" class="card state">结算信息加载中……</section>
    <template v-else>
      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
      <section class="card">
        <h2>收货信息</h2>
        <AddressPicker v-model="selectedAddressId" />
      </section>
      <section class="card">
        <h2>商品清单</h2>
        <article v-for="item in items" :key="item.id" class="item">
          <img :src="toAssetURL(item.picture)" :alt="item.name">
          <div><strong>{{ item.name }}</strong><p>已选：{{ item.selected_spec }}</p></div>
          <span>¥{{ item.price.toFixed(2) }} × {{ item.quantity }}</span>
          <strong>¥{{ (item.price * item.quantity).toFixed(2) }}</strong>
        </article>
      </section>
      <section class="submit-bar"><span>共 {{ items.length }} 种商品</span><div><small>应付金额</small><strong>¥{{ totalAmount.toFixed(2) }}</strong><button :disabled="submitting || checkoutBlocked || items.length === 0" @click="submit">{{ submitting ? '正在提交……' : '提交订单' }}</button></div></section>
    </template>
  </main>
</template>

<style scoped>
.page-shell { width: min(980px, calc(100% - 40px)); margin: 0 auto 50px; color: #26352d; }
header { display: flex; min-height: 88px; align-items: center; justify-content: space-between; color: #68766e; }
.brand { color: #2d6a4f; font: 700 23px Georgia, "Microsoft YaHei", serif; }
h1 { margin: 24px 0; font: 700 38px Georgia, "Microsoft YaHei", serif; }
.card { margin-bottom: 20px; padding: 28px; border-radius: 20px; background: white; box-shadow: 0 8px 30px rgba(46, 64, 54, .06); }
.state { min-height: 260px; text-align: center; }
.card h2 { margin: 0 0 22px; font-size: 19px; }
.item { display: grid; gap: 18px; padding: 16px 0; align-items: center; border-top: 1px solid #edf0ee; grid-template-columns: 70px 1fr auto auto; }
.item img { width: 70px; height: 70px; border-radius: 10px; object-fit: cover; }
.item p { margin: 7px 0 0; color: #8b958f; font-size: 13px; }
.submit-bar { display: flex; padding: 22px 26px; align-items: center; justify-content: space-between; border-radius: 18px; background: white; }
.submit-bar div { display: flex; gap: 15px; align-items: center; }
.submit-bar strong { color: #cf5d42; font-size: 25px; }
.submit-bar button { padding: 12px 26px; border: 0; border-radius: 999px; color: white; background: #2d6a4f; cursor: pointer; }
.submit-bar button:disabled { cursor: not-allowed; opacity: .5; }
.error { padding: 13px 18px; border-radius: 10px; color: #a94938; background: #fff0eb; }
@media (max-width: 650px) { .item { grid-template-columns: 60px 1fr; } .item > span, .item > strong { grid-column: 2; } .submit-bar { align-items: flex-start; gap: 15px; flex-direction: column; } }
</style>
