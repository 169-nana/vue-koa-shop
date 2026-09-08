<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { CartItem } from '../../../shared/api'
import { getCart, removeCart, updateCart } from '../api'
import { toAssetURL } from '../config'
import cartEmpty from '../assets/images/cart_empty.png'

const router = useRouter()
const items = ref<CartItem[]>([])
const selectedIds = ref<number[]>([])
const loading = ref(true)
const updatingId = ref<number | null>(null)
const errorMessage = ref('')

const selectableItems = computed(() =>
  items.value.filter(item => item.stock > 0 && item.quantity <= item.stock)
)
const allSelected = computed({
  get: () => selectableItems.value.length > 0 && selectableItems.value.every(item => selectedIds.value.includes(item.id)),
  set: (checked: boolean) => {
    selectedIds.value = checked ? selectableItems.value.map(item => item.id) : []
  }
})
const selectedItems = computed(() =>
  items.value.filter(item => selectedIds.value.includes(item.id))
)
const totalAmount = computed(() =>
  selectedItems.value.reduce((total, item) => total + item.price * item.quantity, 0)
)

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '操作失败，请稍后重试'
}

async function loadCart() {
  loading.value = true
  errorMessage.value = ''
  try {
    items.value = await getCart()
    selectedIds.value = items.value
      .filter(item => item.stock > 0 && item.quantity <= item.stock)
      .map(item => item.id)
  } catch (error: unknown) {
    errorMessage.value = getErrorMessage(error)
  } finally {
    loading.value = false
  }
}

async function changeQuantity(item: CartItem, amount: number) {
  if (updatingId.value !== null) return
  const nextQuantity = item.quantity + amount
  if (nextQuantity < 1 || nextQuantity > item.stock) return

  updatingId.value = item.id
  errorMessage.value = ''
  try {
    await updateCart({ id: item.id, quantity: nextQuantity })
    item.quantity = nextQuantity
  } catch (error: unknown) {
    errorMessage.value = getErrorMessage(error)
  } finally {
    updatingId.value = null
  }
}

async function removeItem(item: CartItem) {
  if (!window.confirm(`确定从购物车删除“${item.name}”吗？`)) return
  errorMessage.value = ''
  try {
    await removeCart(item.id)
    items.value = items.value.filter(current => current.id !== item.id)
    selectedIds.value = selectedIds.value.filter(id => id !== item.id)
  } catch (error: unknown) {
    errorMessage.value = getErrorMessage(error)
  }
}

function checkout() {
  if (selectedIds.value.length === 0) return
  router.push({ name: 'checkout', query: { cartIds: selectedIds.value.join(',') } })
}

onMounted(loadCart)
</script>

<template>
  <main class="page-shell">
    <header>
      <RouterLink class="brand" to="/">微商城</RouterLink>
      <nav><RouterLink to="/">继续购物</RouterLink><RouterLink to="/orders">我的订单</RouterLink></nav>
    </header>

    <div class="title-row"><div><p>SHOPPING CART</p><h1>我的购物车</h1></div><span>{{ items.length }} 件商品</span></div>
    <section v-if="loading" class="state">购物车加载中……</section>
    <section v-else-if="errorMessage && items.length === 0" class="state error"><p>{{ errorMessage }}</p><button @click="loadCart">重新加载</button></section>
    <section v-else-if="items.length === 0" class="state empty">
      <img :src="cartEmpty" alt="空购物车">
      <h2>购物车还是空的</h2>
      <RouterLink to="/">去挑选商品</RouterLink>
    </section>

    <template v-else>
      <p v-if="errorMessage" class="inline-error">{{ errorMessage }}</p>
      <section class="cart-card">
        <label class="select-all"><input v-model="allSelected" type="checkbox"> 全选</label>
        <article v-for="item in items" :key="item.id" class="cart-item">
          <input v-model="selectedIds" type="checkbox" :value="item.id" :disabled="item.stock === 0 || item.quantity > item.stock">
          <RouterLink :to="{ name: 'goods-detail', params: { id: item.goods_id } }" class="picture">
            <img :src="toAssetURL(item.picture)" :alt="item.name">
          </RouterLink>
          <div class="info"><h2>{{ item.name }}</h2><p>已选：{{ item.selected_spec }}</p><span :class="{ warning: item.stock === 0 || item.quantity > item.stock }">{{ item.stock === 0 ? '已售罄' : `库存 ${item.stock} 件` }}</span></div>
          <strong>¥{{ item.price.toFixed(2) }}</strong>
          <div class="quantity">
            <button :disabled="item.quantity <= 1 || updatingId !== null" @click="changeQuantity(item, -1)">−</button>
            <span>{{ item.quantity }}</span>
            <button :disabled="item.quantity >= item.stock || updatingId !== null" @click="changeQuantity(item, 1)">＋</button>
          </div>
          <strong class="subtotal">¥{{ (item.price * item.quantity).toFixed(2) }}</strong>
          <button class="remove" @click="removeItem(item)">删除</button>
        </article>
      </section>

      <section class="summary">
        <span>已选 {{ selectedItems.length }} 件</span>
        <div><small>合计</small><strong>¥{{ totalAmount.toFixed(2) }}</strong><button :disabled="selectedIds.length === 0" @click="checkout">去结算</button></div>
      </section>
    </template>
  </main>
</template>

<style scoped>
.page-shell { width: min(1120px, calc(100% - 40px)); margin: 0 auto; color: #26352d; }
header { display: flex; min-height: 88px; align-items: center; justify-content: space-between; }
.brand { color: #2d6a4f; font: 700 23px Georgia, "Microsoft YaHei", serif; }
nav { display: flex; gap: 22px; color: #68766e; font-size: 14px; }
.title-row { display: flex; margin: 28px 0 22px; align-items: end; justify-content: space-between; }
.title-row p { margin: 0 0 8px; color: #7a8e80; font-size: 11px; font-weight: 700; letter-spacing: .2em; }
h1 { margin: 0; font: 700 38px Georgia, "Microsoft YaHei", serif; }
.title-row > span { color: #89958e; }
.state { display: grid; min-height: 430px; place-items: center; align-content: center; border-radius: 22px; background: white; }
.state button, .empty a { padding: 11px 20px; border: 0; border-radius: 999px; color: white; background: #2d6a4f; cursor: pointer; }
.empty img { width: 150px; opacity: .7; }
.empty h2 { margin: 18px 0; }
.error, .inline-error { color: #b54d3a; }
.cart-card { overflow: hidden; border-radius: 20px; background: white; box-shadow: 0 8px 30px rgba(46, 64, 54, .07); }
.select-all { display: block; padding: 17px 24px; border-bottom: 1px solid #edf0ee; }
.cart-item { display: grid; gap: 18px; padding: 20px 24px; align-items: center; border-bottom: 1px solid #edf0ee; grid-template-columns: auto 90px minmax(160px, 1fr) 90px 110px 100px auto; }
.picture { width: 90px; height: 90px; overflow: hidden; border-radius: 12px; background: #eef1ee; }
.picture img { width: 100%; height: 100%; object-fit: cover; }
.info h2 { margin: 0 0 8px; font-size: 17px; }
.info p, .info span { margin: 0; color: #8b958f; font-size: 13px; }
.info .warning { color: #c45c42; }
.quantity { display: flex; align-items: center; justify-content: center; }
.quantity button { width: 30px; height: 30px; border: 1px solid #d9dfdb; background: white; cursor: pointer; }
.quantity span { width: 38px; text-align: center; }
.subtotal { color: #cf5d42; }
.remove { border: 0; color: #9b6257; background: none; cursor: pointer; }
.summary { position: sticky; bottom: 18px; display: flex; margin: 22px 0 40px; padding: 20px 24px; align-items: center; justify-content: space-between; border-radius: 18px; background: white; box-shadow: 0 10px 35px rgba(46, 64, 54, .12); }
.summary div { display: flex; gap: 14px; align-items: center; }
.summary strong { color: #cf5d42; font-size: 25px; }
.summary button { padding: 12px 28px; border: 0; border-radius: 999px; color: white; background: #2d6a4f; cursor: pointer; }
.summary button:disabled { cursor: not-allowed; opacity: .5; }
@media (max-width: 820px) { .cart-item { grid-template-columns: auto 72px 1fr; } .picture { width: 72px; height: 72px; } .cart-item > strong, .quantity, .remove { grid-column: 3; } .subtotal { display: none; } }
</style>
