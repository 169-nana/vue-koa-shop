<template>
  <main class="auth-page">
    <form
      class="auth-form"
      @submit.prevent="submit"
    >
      <h1>用户登录</h1>

      <label>
        用户名

        <input
          v-model.trim="username"
          type="text"
          autocomplete="username"
          placeholder="请输入用户名"
        >
      </label>

      <label>
        密码

        <input
          v-model="password"
          type="password"
          autocomplete="current-password"
          placeholder="请输入密码"
        >
      </label>

      <p
        v-if="errorMessage"
        class="error"
      >
        {{ errorMessage }}
      </p>

      <button
        type="submit"
        :disabled="loading"
      >
        {{ loading ? '登录中...' : '登录' }}
      </button>

      <p>
        还没有账号？
        <RouterLink to="/register">
          立即注册
        </RouterLink>
      </p>
    </form>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { login, getUser } from '../api'

import useTokenStore from '../stores/token'
import useUserStore from '../stores/user'

const route = useRoute()
const router = useRouter()
const tokenStore = useTokenStore()
const userStore = useUserStore()

const username = ref(
  typeof route.query.username === 'string'
    ? route.query.username
    : ''
)

const password = ref('')
const loading = ref(false)
const errorMessage = ref('')

const submit = async () => {
  errorMessage.value = ''

  if (!username.value || !password.value) {
    errorMessage.value =
      '请输入用户名和密码'
    return
  }

  loading.value = true

  try {
    const loginData = await login({
      username: username.value,
      password: password.value
    })

    tokenStore.updateToken(
      loginData.token
    )

    const user = await getUser()
    userStore.updateUser(user)

    const redirect = route.query.redirect

    router.replace(
      typeof redirect === 'string'
        ? redirect
        : { name: 'profile' }
    )
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '操作失败，请稍后重试'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-page {
  display: grid;
  min-height: 100vh;
  padding: 20px;
  place-items: center;
}

.auth-form {
  display: grid;
  width: min(100%, 400px);
  gap: 20px;
  padding: 32px;
  background: white;
  border-radius: 12px;
}

label {
  display: grid;
  gap: 8px;
}

input {
  width: 100%;
  padding: 12px;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
}

button {
  padding: 12px;
  color: white;
  background: #409eff;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.error {
  margin: 0;
  color: #f56c6c;
}

a {
  color: #409eff;
}
</style>