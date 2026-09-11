<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { NotificationItem } from '../../../shared/api'
import { getNotifications, readAllNotifications, readNotification } from '../api'

const list = ref<NotificationItem[]>([]), loading = ref(true), unreadOnly = ref(false), errorMessage = ref('')
async function load() {
  loading.value = true; errorMessage.value = ''
  try { list.value = (await getNotifications({ pagesize: 100, unread_only: unreadOnly.value })).list }
  catch (error: unknown) { errorMessage.value = error instanceof Error ? error.message : '消息加载失败' }
  finally { loading.value = false }
}
async function open(item: NotificationItem) {
  if (!item.read_at) { await readNotification(item.id); item.read_at = new Date().toISOString() }
}
async function readAll() { await readAllNotifications(); await load() }
function target(item: NotificationItem) { return item.business_type === 'merchant_application' ? '/merchant/apply' : '/merchant-service' }
onMounted(load)
</script>
<template>
  <main class="page"><header><div><RouterLink to="/profile">← 返回个人中心</RouterLink><h1>消息中心</h1></div><button v-if="list.some(item => !item.read_at)" @click="readAll">全部已读</button></header>
    <div class="filters"><label><input v-model="unreadOnly" type="checkbox" @change="load"> 只看未读</label></div>
    <p v-if="errorMessage" class="error">{{ errorMessage }}</p><section v-if="loading" class="empty">加载中……</section><section v-else-if="!list.length" class="empty">暂无消息</section>
    <section v-else class="messages"><RouterLink v-for="item in list" :key="item.id" :to="target(item)" class="message" :class="{ unread: !item.read_at }" @click="open(item)"><span v-if="!item.read_at" class="dot"/><div><strong>{{ item.title }}</strong><p>{{ item.content }}</p><time>{{ new Date(item.created_at).toLocaleString() }}</time></div><b>查看 →</b></RouterLink></section>
  </main>
</template>
<style scoped>
.page { width: min(900px, calc(100% - 32px)); margin: 42px auto 70px; color: #293b31; }header { display: flex; align-items: end; justify-content: space-between; }header a { color: #39725b; }h1 { margin: 20px 0 0; font-size: 34px; }button { padding: 9px 17px; border: 1px solid #b9cbbf; border-radius: 999px; color: #2d6a4f; background: white; cursor: pointer; }.filters { margin: 22px 0; color: #65766d; }.messages { display: grid; gap: 12px; }.message { position: relative; display: grid; grid-template-columns: 1fr auto; gap: 20px; padding: 22px 24px; border: 1px solid #e1e9e3; border-radius: 14px; color: inherit; background: white; }.message.unread { border-color: #bcd3c4; background: #f5faf7; }.message p { margin: 8px 0; color: #5e7066; line-height: 1.7; }.message time { color: #8a978f; font-size: 12px; }.message b { align-self: center; color: #2d6a4f; font-size: 13px; }.dot { position: absolute; top: 17px; left: 10px; width: 7px; height: 7px; border-radius: 50%; background: #d66b4c; }.empty { display: grid; min-height: 260px; place-items: center; border-radius: 18px; color: #77877e; background: white; }.error { color: #b34838; }
</style>
