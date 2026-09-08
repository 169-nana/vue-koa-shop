<template>
  <RouterView :key="route.meta.requiresAuth ? sessionRevision : 0" />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import useTokenStore from './stores/token'
import useUserStore from './stores/user'
const tokenStore = useTokenStore(), userStore = useUserStore()
const route = useRoute(), router = useRouter()
const sessionRevision = ref(0)
watch(() => tokenStore.token, token => {
  userStore.removeUser()
  sessionRevision.value++
  if (!token && route.matched.some(record => record.meta.requiresAuth)) {
    void router.replace({ name: 'login', query: { redirect: route.fullPath } })
  }
}, { flush: 'sync' })
function synchronizeSession(event: StorageEvent) {
  if (event.storageArea === localStorage && (event.key === 'shop_user_token' || event.key === null)) tokenStore.syncFromStorage()
}
onMounted(() => window.addEventListener('storage', synchronizeSession))
onUnmounted(() => window.removeEventListener('storage', synchronizeSession))
</script>

<style>
* {
  box-sizing: border-box;
}

html,
body,
#app {
  min-height: 100%;
  margin: 0;
}

body {
  color: #333;
  background: #f5f7fa;
  font-family:
    Arial,
    "Microsoft YaHei",
    sans-serif;
}

button,
input {
  font: inherit;
}

a {
  color: inherit;
  text-decoration: none;
}
</style>
