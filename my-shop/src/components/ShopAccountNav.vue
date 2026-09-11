<template>
  <nav class="account-nav" aria-label="用户导航">
    <RouterLink class="merchant-link" to="/merchant-service" target="_blank" rel="noopener">商家服务</RouterLink>
    <RouterLink to="/cart">购物车</RouterLink>
    <RouterLink v-if="tokenStore.token" class="notification-link" to="/notifications" aria-label="消息中心">
      <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg><span>消息</span><b v-if="unreadCount > 0" class="badge">{{ unreadCount > 99 ? '99+' : unreadCount }}</b>
    </RouterLink>
    <template v-if="!tokenStore.token">
      <RouterLink to="/login">登录</RouterLink>
      <RouterLink class="register-link" to="/register">注册</RouterLink>
    </template>
    <div v-else class="account-user">
      <RouterLink class="avatar-link" to="/profile" aria-label="进入个人中心"><img :src="avatarURL" alt="" @error="avatarFailed = true" /></RouterLink>
      <details ref="menu" class="account-menu" @keydown.esc.prevent="closeMenu">
        <summary aria-label="用户账号菜单"><span class="username">{{ userStore.user.username || (loading ? '加载中…' : '我的账号') }}</span><span aria-hidden="true">⌄</span></summary>
        <div class="dropdown" @click="closeMenu">
          <p class="account-name">{{ userStore.user.username || '我的账号' }}</p>
          <template v-if="loadFailed"><p class="load-error" role="status">用户信息加载失败</p><button type="button" @click.stop="restoreUser">重新加载</button></template>
          <RouterLink to="/profile">个人中心</RouterLink>
          <RouterLink to="/orders">我的订单</RouterLink>
          <button class="logout" type="button" @click="logout">退出登录</button>
        </div>
      </details>
    </div>
  </nav>
</template>
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { getUnreadNotificationCount, getUser } from '../api'
import { toAssetURL } from '../config'
import defaultAvatar from '../assets/images/avatar_default.png'
import useTokenStore from '../stores/token'
import useUserStore from '../stores/user'
const tokenStore = useTokenStore(), userStore = useUserStore()
const menu = ref<HTMLDetailsElement>()
const loading = ref(false), loadFailed = ref(false), avatarFailed = ref(false)
const unreadCount = ref(0)
let notificationTimer: ReturnType<typeof setInterval> | undefined
let requestVersion = 0
let disposed = false
const avatarURL = computed(() => !avatarFailed.value && userStore.user.avatar ? toAssetURL(userStore.user.avatar) : defaultAvatar)
watch(() => userStore.user.avatar, () => { avatarFailed.value = false })
watch(() => tokenStore.token, token => {
  requestVersion++
  loading.value = false
  loadFailed.value = false
  closeMenu()
  if (token) { void restoreUser(); void restoreUnreadCount() }
  else unreadCount.value = 0
})
function closeMenu() { if (menu.value) menu.value.open = false }
function onOutsideClick(event: PointerEvent) { if (event.target instanceof Node && !menu.value?.contains(event.target)) closeMenu() }
function logout() { closeMenu(); tokenStore.removeToken(); userStore.removeUser() }
async function restoreUser() {
  const sessionToken = tokenStore.token
  if (!sessionToken || loading.value) return
  loading.value = true
  const version = ++requestVersion
  loadFailed.value = false
  try {
    const user = await getUser()
    if (!disposed && version === requestVersion && tokenStore.token === sessionToken) userStore.updateUser(user)
  } catch {
    if (!disposed && version === requestVersion && tokenStore.token === sessionToken) loadFailed.value = true
  } finally { if (version === requestVersion) loading.value = false }
}
async function restoreUnreadCount() {
  if (!tokenStore.token) return
  try { unreadCount.value = (await getUnreadNotificationCount()).count } catch { /* 保留上一次计数 */ }
}
onMounted(() => {
  if (tokenStore.token && userStore.user.id === null) void restoreUser()
  if (tokenStore.token) void restoreUnreadCount()
  notificationTimer = setInterval(restoreUnreadCount, 60_000)
  document.addEventListener('pointerdown', onOutsideClick)
})
onUnmounted(() => { disposed = true; if (notificationTimer) clearInterval(notificationTimer); document.removeEventListener('pointerdown', onOutsideClick) })
</script>
<style scoped>
.account-nav { display: flex; align-items: center; gap: 22px; color: #526158; font-size: 14px; }.merchant-link { color: #2d6a4f; font-weight: 600; }.register-link { border: 1px solid #bfd2c5; border-radius: 999px; padding: 8px 17px; color: #2d6a4f; }.account-user { display: flex; align-items: center; gap: 8px; }.avatar-link { display: block; width: 32px; height: 32px; border-radius: 50%; }.avatar-link img { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; background: #e8eee9; }.account-menu { position: relative; }.account-menu summary { display: flex; align-items: center; gap: 6px; cursor: pointer; list-style: none; color: #2d6a4f; }.account-menu summary::-webkit-details-marker { display: none; }.username { max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.dropdown { position: absolute; right: 0; top: calc(100% + 12px); z-index: 20; width: 190px; padding: 8px; border: 1px solid #dce7df; border-radius: 12px; background: white; box-shadow: 0 12px 32px #284e351a; }.dropdown a, .dropdown button { display: block; width: 100%; padding: 11px 12px; border: 0; border-radius: 6px; background: none; text-align: left; color: #365640; font-size: 13px; cursor: pointer; }.dropdown a:hover, .dropdown button:hover { background: #f0f5ee; }.account-name { margin: 0 4px 5px; padding: 10px 8px; border-bottom: 1px solid #edf1eb; overflow-wrap: anywhere; font-weight: 600; }.dropdown .logout { color: #b14d3c; }.load-error { margin: 8px 12px; font-size: 12px; color: #b14d3c; }.account-nav a:focus-visible, summary:focus-visible, button:focus-visible { outline: 2px solid #2d6a4f; outline-offset: 3px; }
.notification-link { position: relative; display: inline-flex; align-items: center; gap: 6px; }.notification-link svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }.badge { position: absolute; top: -8px; left: 13px; min-width: 7px; height: 7px; padding: 0; overflow: hidden; border: 2px solid white; border-radius: 999px; color: transparent; background: #d85b47; font-size: 0; line-height: 0; }
@media(max-width: 600px) { .account-nav { gap: 12px; font-size: 13px; }.username { display: none; }.register-link { padding: 7px 12px; } }
</style>
