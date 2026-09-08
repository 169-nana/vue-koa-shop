<template>
  <AuthLayout>
    <form class="auth-form" :aria-busy="loading" @submit.prevent="submit">
      <p class="form-eyebrow">开启你的选购旅程</p><h1>创建新账号</h1><p class="form-intro">加入微商城，把喜欢的好物带回家。</p>
      <div class="field"><label for="register-username">用户名</label><input id="register-username" v-model.trim="username" name="username" autocomplete="username" placeholder="为自己取一个用户名" :disabled="loading" aria-describedby="username-hint register-feedback" /><p id="username-hint" class="field-hint">3–20 位字母、数字或下划线</p></div>
      <div class="field"><label for="register-password">密码</label><AuthPassword id="register-password" v-model="password" autocomplete="new-password" placeholder="设置 6–20 个字符的密码" :disabled="loading" describedby="register-feedback" /></div>
      <div class="field"><label for="register-confirmation">确认密码</label><AuthPassword id="register-confirmation" v-model="confirmation" autocomplete="new-password" placeholder="请再次输入密码" :disabled="loading" describedby="register-feedback" /></div>
      <p id="register-feedback" class="form-feedback" role="status" aria-live="polite">{{ errorMessage }}</p>
      <button class="submit-button" type="submit" :disabled="loading"><span v-if="loading" class="loading-dot" aria-hidden="true"></span>{{ loading ? '正在创建账号…' : '创建账号' }}</button>
      <p class="form-switch">已有账号？<RouterLink :to="{ name: 'login', query: { redirect } }">返回登录</RouterLink></p>
    </form>
  </AuthLayout>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { register } from '../api'
import AuthLayout from '../components/AuthLayout.vue'
import AuthPassword from '../components/AuthPassword.vue'
import { getAuthRedirect } from '../../../shared/auth'
const route = useRoute(), router = useRouter()
const username = ref(''), password = ref(''), confirmation = ref('')
const loading = ref(false), errorMessage = ref('')
const redirect = computed(() => getAuthRedirect(route.query.redirect, '/'))
function invalid(message: string, id: string) { errorMessage.value = message; document.getElementById(id)?.focus() }
async function submit() {
  if (loading.value) return
  errorMessage.value = ''
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username.value)) return invalid('用户名必须为 3–20 位字母、数字或下划线', 'register-username')
  if (password.value.length < 6 || password.value.length > 20) return invalid('密码长度必须为 6–20 个字符', 'register-password')
  if (password.value !== confirmation.value) return invalid('两次输入的密码不一致', 'register-confirmation')
  loading.value = true
  try {
    await register({ username: username.value, password: password.value })
    await router.replace({ name: 'login', query: { username: username.value, registered: '1', redirect: redirect.value } })
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : '注册失败，请稍后重试'
  } finally { loading.value = false }
}
</script>
