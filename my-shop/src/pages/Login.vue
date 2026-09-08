<template>
  <AuthLayout>
    <form class="auth-form" :aria-busy="loading" @submit.prevent="submit">
      <p class="form-eyebrow">欢迎来到微商城</p><h1>欢迎回来</h1><p class="form-intro">登录后查看订单，继续选购心仪商品。</p>
      <div class="field"><label for="login-username">用户名</label><input id="login-username" v-model.trim="username" name="username" autocomplete="username" placeholder="请输入用户名" :disabled="loading" aria-describedby="login-feedback" /></div>
      <div class="field"><label for="login-password">密码</label><AuthPassword id="login-password" v-model="password" autocomplete="current-password" placeholder="请输入登录密码" :disabled="loading" describedby="login-feedback" /></div>
      <p id="login-feedback" class="form-feedback" :class="{ success: !errorMessage }" role="status" aria-live="polite">{{ errorMessage || (registered ? '注册成功，请登录你的新账号。' : '') }}</p>
      <button class="submit-button" type="submit" :disabled="loading"><span v-if="loading" class="loading-dot" aria-hidden="true"></span>{{ loading ? '正在登录…' : '登录' }}</button>
      <p class="form-switch">还没有账号？<RouterLink :to="{ name: 'register', query: { redirect } }">立即注册</RouterLink></p>
    </form>
  </AuthLayout>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { login, getUser } from '../api'
import useTokenStore from '../stores/token'
import useUserStore from '../stores/user'
import AuthLayout from '../components/AuthLayout.vue'
import AuthPassword from '../components/AuthPassword.vue'
import { getAuthRedirect } from '../../../shared/auth'
const route = useRoute(), router = useRouter()
const tokenStore = useTokenStore(), userStore = useUserStore()
const username = ref(typeof route.query.username === 'string' ? route.query.username : '')
const password = ref(''), loading = ref(false), errorMessage = ref('')
const redirect = computed(() => getAuthRedirect(route.query.redirect, '/'))
const registered = computed(() => route.query.registered === '1')
async function submit() {
  if (loading.value) return
  errorMessage.value = ''
  if (!username.value || !password.value) {
    errorMessage.value = '请输入用户名和密码'
    document.getElementById(!username.value ? 'login-username' : 'login-password')?.focus()
    return
  }
  loading.value = true
  let receivedToken = ''
  try {
    const result = await login({ username: username.value, password: password.value })
    tokenStore.updateToken(result.token)
    receivedToken = result.token
    userStore.updateUser(await getUser())
    await router.replace(redirect.value)
  } catch (error: unknown) {
    if (receivedToken && tokenStore.token === receivedToken) { tokenStore.removeToken(); userStore.removeUser() }
    errorMessage.value = error instanceof Error ? error.message : '登录失败，请稍后重试'
  } finally { loading.value = false }
}
</script>
