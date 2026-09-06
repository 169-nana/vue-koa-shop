<template>
  <main class="profile">
    <h1>个人中心</h1>

    <p v-if="loading">
      用户信息加载中...
    </p>

    <p
      v-else-if="errorMessage"
      class="error"
    >
      {{ errorMessage }}
    </p>

    <section v-else>
      <p>用户编号：{{ user.id }}</p>
      <p>用户名：{{ user.username }}</p>
    </section>

    <button @click="logout">
      退出登录
    </button>

    <RouterLink to="/">
      返回首页
    </RouterLink>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { useRouter } from 'vue-router'

import { getUser } from '../api'
import useTokenStore from '../stores/token'
import useUserStore from '../stores/user'

const router = useRouter()
const tokenStore = useTokenStore()
const userStore = useUserStore()
const { user } = userStore

const loading = ref(true)
const errorMessage = ref('')

onMounted(async () => {
  try {
    const data = await getUser()
    userStore.updateUser(data)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '操作失败，请稍后重试'
  } finally {
    loading.value = false
  }
})

const logout = () => {
  tokenStore.removeToken()
  userStore.removeUser()

  router.replace({
    name: 'login'
  })
}
</script>

<style scoped>
.profile {
  width: min(100% - 40px, 600px);
  margin: 80px auto;
  padding: 32px;
  background: white;
  border-radius: 12px;
}

button {
  margin-right: 20px;
  padding: 10px 18px;
}

.error {
  color: #f56c6c;
}

a {
  color: #409eff;
}
</style>