<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { UserDashboard } from '../../../shared/api'
import { changeUserAvatar, getUser, getUserDashboard, uploadUserAvatar } from '../api'
import { toAssetURL } from '../config'
import defaultAvatar from '../assets/images/avatar_default.png'
import useTokenStore from '../stores/token'
import useUserStore from '../stores/user'

const router = useRouter()
const tokenStore = useTokenStore()
const userStore = useUserStore()
const loading = ref(true)
const uploading = ref(false)
const errorMessage = ref('')
const avatarInput = ref<HTMLInputElement | null>(null)
const dashboard = ref<UserDashboard>({ cart_count: 0, pending_order_count: 0, after_sale_count: 0, reviewable_count: 0 })
const avatarURL = computed(() => userStore.user.avatar ? toAssetURL(userStore.user.avatar) : defaultAvatar)

async function loadProfile() {
  loading.value = true
  errorMessage.value = ''
  try {
    const [user, counts] = await Promise.all([getUser(), getUserDashboard()])
    userStore.updateUser(user)
    dashboard.value = counts
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : '个人中心加载失败'
  } finally {
    loading.value = false
  }
}

function selectAvatar() {
  if (!uploading.value) avatarInput.value?.click()
}

async function updateAvatar(event: Event) {
  const input = event.target
  if (!(input instanceof HTMLInputElement)) return
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
    errorMessage.value = '头像只支持 JPG、PNG、WebP 或 GIF 图片'
    return
  }
  if (file.size > 500 * 1024) {
    errorMessage.value = '头像大小不能超过 500KB'
    return
  }
  uploading.value = true
  errorMessage.value = ''
  try {
    const uploaded = await uploadUserAvatar(file)
    const saved = await changeUserAvatar(uploaded.savepath)
    userStore.user.avatar = saved.avatar
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : '头像修改失败'
  } finally {
    uploading.value = false
  }
}

function logout() {
  tokenStore.removeToken()
  userStore.removeUser()
  router.replace({ name: 'home' })
}

onMounted(loadProfile)
</script>

<template>
  <main class="profile-page">
    <header class="topbar"><RouterLink class="brand" to="/">微商城</RouterLink><RouterLink class="home-link" to="/">返回商城首页</RouterLink></header>
    <section v-if="loading" class="state-card">个人中心加载中……</section>
    <section v-else-if="errorMessage && userStore.user.id === null" class="state-card error"><p>{{ errorMessage }}</p><button type="button" @click="loadProfile">重新加载</button></section>

    <template v-else>
      <section class="hero-card">
        <div class="hero-pattern" />
        <div class="identity">
          <button class="avatar-button" type="button" :disabled="uploading" @click="selectAvatar"><img :src="avatarURL" alt="用户头像"><span>{{ uploading ? '上传中' : '更换头像' }}</span></button>
          <input ref="avatarInput" class="file-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" @change="updateAvatar">
          <div><p class="eyebrow">MEMBER CENTER</p><h1>{{ userStore.user.username }}</h1><p class="member-id">商城会员 · ID {{ userStore.user.id }}</p></div>
        </div>
        <button class="logout" type="button" @click="logout">退出登录</button>
      </section>

      <p v-if="errorMessage" class="inline-error">{{ errorMessage }}</p>
      <section class="order-panel">
        <div class="section-heading"><div><p>ORDER SERVICE</p><h2>订单服务</h2></div><RouterLink to="/orders">查看全部订单 →</RouterLink></div>
        <div class="order-grid">
          <RouterLink class="service-card featured" :to="{ name: 'orders', query: { status: 'pending' } }"><span class="service-icon">⌛</span><strong>待支付</strong><small>等待完成付款的订单</small><b>{{ dashboard.pending_order_count }}</b></RouterLink>
          <RouterLink class="service-card" to="/after-sales"><span class="service-icon">↩</span><strong>售后 / 退款</strong><small>查看售后申请进度</small><b>{{ dashboard.after_sale_count }}</b></RouterLink>
          <RouterLink class="service-card" to="/reviews"><span class="service-icon">☆</span><strong>评价商品</strong><small>分享购买和使用体验</small><b>{{ dashboard.reviewable_count }}</b></RouterLink>
          <RouterLink class="service-card" to="/orders"><span class="service-icon">▤</span><strong>查看订单</strong><small>查询订单与配送状态</small><em>进入</em></RouterLink>
        </div>
      </section>

      <section class="tool-panel">
        <div class="section-heading"><div><p>MY TOOLS</p><h2>常用工具</h2></div></div>
        <div class="tool-grid">
          <RouterLink to="/cart"><span>购物袋</span><strong>我的购物车</strong><small>{{ dashboard.cart_count }} 件商品</small></RouterLink>
          <RouterLink to="/addresses"><span>地址簿</span><strong>收货地址</strong><small>管理默认收货信息</small></RouterLink>
          <button type="button" @click="selectAvatar"><span>个人资料</span><strong>修改头像</strong><small>支持 500KB 内图片</small></button>
        </div>
      </section>
    </template>
  </main>
</template>

<style scoped>
.profile-page { width: min(1080px, calc(100% - 40px)); margin: 0 auto 64px; color: #26352d; }
.topbar { display: flex; min-height: 86px; align-items: center; justify-content: space-between; }.brand { color: #2d6a4f; font: 700 23px Georgia, "Microsoft YaHei", serif; }.home-link { color: #65756c; font-size: 14px; }
.state-card { display: grid; min-height: 420px; place-items: center; align-content: center; border-radius: 24px; background: white; }.state-card button { padding: 10px 20px; border: 0; border-radius: 999px; color: white; background: #2d6a4f; cursor: pointer; }.error { color: #b54d3a; }
.hero-card { position: relative; display: flex; min-height: 244px; padding: 42px 46px; overflow: hidden; align-items: center; justify-content: space-between; border-radius: 28px; color: white; background: linear-gradient(125deg, #173f30, #327159 60%, #51836c); box-shadow: 0 20px 48px rgba(32,76,56,.2); }.hero-pattern { position: absolute; width: 360px; height: 360px; top: -210px; right: 180px; border: 65px solid rgba(255,255,255,.06); border-radius: 50%; }.identity { position: relative; display: flex; gap: 27px; align-items: center; }.avatar-button { position: relative; width: 126px; height: 126px; padding: 0; overflow: hidden; border: 4px solid rgba(255,255,255,.85); border-radius: 50%; background: #e8eee9; cursor: pointer; }.avatar-button img { width: 100%; height: 100%; object-fit: cover; }.avatar-button span { position: absolute; right: 0; bottom: 0; left: 0; padding: 8px 3px 10px; color: white; background: rgba(19,45,34,.78); font-size: 12px; transform: translateY(100%); transition: transform .2s; }.avatar-button:hover span, .avatar-button:focus span { transform: translateY(0); }.file-input { display: none; }.eyebrow { margin: 0 0 9px; color: #bbd3c5; font-size: 11px; font-weight: 700; letter-spacing: .22em; }.identity h1 { margin: 0; font: 700 clamp(29px, 4vw, 42px) Georgia, "Microsoft YaHei", serif; }.member-id { margin: 12px 0 0; color: #d9e7df; font-size: 14px; }.logout { position: relative; padding: 10px 20px; border: 1px solid rgba(255,255,255,.5); border-radius: 999px; color: white; background: rgba(255,255,255,.08); cursor: pointer; }.logout:hover { background: rgba(255,255,255,.17); }
.inline-error { padding: 12px 16px; border-radius: 10px; color: #a94837; background: #fff0ea; }.order-panel, .tool-panel { margin-top: 25px; padding: 30px; border-radius: 24px; background: white; box-shadow: 0 9px 32px rgba(46,64,54,.06); }.section-heading { display: flex; margin-bottom: 23px; align-items: end; justify-content: space-between; }.section-heading p { margin: 0 0 7px; color: #8b9b92; font-size: 10px; font-weight: 700; letter-spacing: .2em; }.section-heading h2 { margin: 0; font-size: 23px; }.section-heading > a { color: #2d6a4f; font-size: 13px; }
.order-grid { display: grid; gap: 14px; grid-template-columns: repeat(4, 1fr); }.service-card { position: relative; display: flex; min-height: 175px; padding: 22px; flex-direction: column; border: 1px solid #e6ece8; border-radius: 17px; background: #fafcfb; transition: .2s; }.service-card:hover { border-color: #b9d0c2; box-shadow: 0 10px 25px rgba(42,78,59,.08); transform: translateY(-2px); }.service-card.featured { background: #f4f8f5; }.service-icon { margin-bottom: 17px; color: #317056; font-size: 27px; }.service-card strong { font-size: 16px; }.service-card small { margin-top: 7px; color: #8a9790; line-height: 1.5; }.service-card b, .service-card em { position: absolute; top: 18px; right: 18px; min-width: 25px; padding: 4px 7px; border-radius: 999px; color: white; background: #d66b4c; font-size: 12px; font-style: normal; text-align: center; }.service-card em { color: #2d6a4f; background: #e4efe8; }
.tool-grid { display: grid; gap: 14px; grid-template-columns: repeat(3, 1fr); }.tool-grid a, .tool-grid button { display: grid; padding: 21px; border: 0; border-radius: 16px; color: inherit; background: #f5f7f5; cursor: pointer; text-align: left; }.tool-grid span { margin-bottom: 13px; color: #71837a; font-size: 12px; }.tool-grid strong { font-size: 16px; }.tool-grid small { margin-top: 7px; color: #929d97; }
@media (max-width: 780px) { .hero-card { padding: 32px; }.order-grid { grid-template-columns: repeat(2, 1fr); }.tool-grid { grid-template-columns: 1fr; } }
@media (max-width: 520px) { .profile-page { width: min(100% - 24px,1080px); }.hero-card { align-items: flex-start; }.identity { gap: 16px; }.avatar-button { width: 88px; height: 88px; }.logout { position: absolute; right: 20px; bottom: 20px; }.order-panel, .tool-panel { padding: 20px; }.order-grid { grid-template-columns: 1fr; }.service-card { min-height: 145px; } }
</style>
