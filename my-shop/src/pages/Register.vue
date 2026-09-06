<template>
  <main class="auth-page">
    <form
      class="auth-form"
      @submit.prevent="submit"
    >
      <h1>用户注册</h1>

      <label>
        用户名

        <input
          v-model.trim="username"
          autocomplete="username"
          placeholder="3到20位字母、数字或下划线"
        >
      </label>

      <label>
        密码

        <input
          v-model="password"
          type="password"
          autocomplete="new-password"
          placeholder="6到20个字符"
        >
      </label>

      <label>
        确认密码

        <input
          v-model="passwordAgain"
          type="password"
          autocomplete="new-password"
          placeholder="请再次输入密码"
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
        {{ loading ? '注册中...' : '注册' }}
      </button>

      <p>
        已有账号？
        <RouterLink to="/login">
          返回登录
        </RouterLink>
      </p>
    </form>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { register } from '../api'

const router = useRouter()

const username = ref('')
const password = ref('')
const passwordAgain = ref('')
const loading = ref(false)
const errorMessage = ref('')

const submit = async () => {
  errorMessage.value = ''

  if (
    !/^[a-zA-Z0-9_]{3,20}$/.test(
      username.value
    )
  ) {
    errorMessage.value =
      '用户名必须是3到20位字母、数字或下划线'
    return
  }

  if (
    password.value.length < 6 ||
    password.value.length > 20
  ) {
    errorMessage.value =
      '密码长度必须在6到20个字符之间'
    return
  }

  if (
    password.value !==
    passwordAgain.value
  ) {
    errorMessage.value =
      '两次输入的密码不一致'
    return
  }

  loading.value = true

  try {
    await register({
      username: username.value,
      password: password.value
    })

    router.replace({
      name: 'login',
      query: {
        username: username.value
      }
    })
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
}

button:disabled {
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