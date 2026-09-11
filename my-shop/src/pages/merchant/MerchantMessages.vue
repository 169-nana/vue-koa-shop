<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { NotificationItem } from '../../../../shared/api'
import { getNotifications, readAllNotifications, readNotification } from '../../api'

const route = useRoute(), router = useRouter()
const list = ref<NotificationItem[]>([])
const loading = ref(true), unreadOnly = ref(false), errorMessage = ref('')
async function load() {
  loading.value = true; errorMessage.value = ''
  try { list.value = (await getNotifications({ pagesize: 100, unread_only: unreadOnly.value })).list }
  catch (error: unknown) { errorMessage.value = error instanceof Error ? error.message : '消息加载失败' }
  finally { loading.value = false }
}
async function open(item: NotificationItem) {
  if (!item.read_at) {
    await readNotification(item.id)
    item.read_at = new Date().toISOString()
  }
  await router.push({
    name: item.business_type === 'merchant_application'
      ? 'merchant-stores'
      : item.type === 'goods_forced_off_sale' ? 'merchant-products' : 'merchant-submissions',
    params: { merchantId: route.params.merchantId }
  })
}
async function readAll() { await readAllNotifications(); await load() }
onMounted(load)
</script>

<template>
  <div>
    <div class="heading"><div><p>MESSAGES</p><h1>消息中心</h1><span>审核结果和店铺通知都集中在这里。</span></div><button v-if="list.some(item => !item.read_at)" type="button" @click="readAll">全部已读</button></div>
    <p v-if="errorMessage" class="notice">{{ errorMessage }}</p>
    <section class="toolbar"><label><input v-model="unreadOnly" type="checkbox" @change="load">只看未读消息</label><span>共 {{ list.length }} 条</span></section>
    <section class="panel">
      <p v-if="loading" class="empty">消息加载中……</p><p v-else-if="!list.length" class="empty">暂无消息</p>
      <div v-else class="messages"><button v-for="item in list" :key="item.id" type="button" class="message" :class="{ unread: !item.read_at }" @click="open(item)"><i v-if="!item.read_at"/><div><strong>{{ item.title }}</strong><p>{{ item.content }}</p><time>{{ new Date(item.created_at).toLocaleString() }}</time></div><b>查看详情 →</b></button></div>
    </section>
  </div>
</template>

<style scoped>
.heading{display:flex;align-items:end;justify-content:space-between;gap:20px}.heading>div>p{margin:0 0 7px;color:#809087;font-size:10px;font-weight:700;letter-spacing:.2em}.heading h1{margin:0;font-size:30px}.heading span{display:block;margin-top:7px;color:#78867e;font-size:13px}.heading>button{padding:9px 16px;border:1px solid #c7d5cb;border-radius:999px;color:#2d6a4f;background:white;cursor:pointer}.toolbar{display:flex;margin-top:22px;padding:13px 16px;align-items:center;justify-content:space-between;border:1px solid #e0e7e2;border-radius:13px;background:white;color:#728078;font-size:13px}.toolbar label{display:flex;align-items:center;gap:8px}.panel{margin-top:14px;padding:18px;border:1px solid #e0e7e2;border-radius:16px;background:white}.messages{display:grid;gap:9px}.message{position:relative;display:grid;width:100%;padding:15px 16px;grid-template-columns:minmax(0,1fr) auto;gap:18px;border:1px solid #e6ece8;border-radius:11px;color:#2d4035;background:white;text-align:left;cursor:pointer}.message.unread{border-color:#bfd5c6;background:#f4faf6}.message i{position:absolute;top:14px;left:7px;width:6px;height:6px;border-radius:50%;background:#d76547}.message p{margin:6px 0;color:#63746a;line-height:1.5}.message time{color:#929d96;font-size:11px}.message b{align-self:center;color:#2d6a4f;font-size:12px}.notice{padding:12px 15px;border-radius:9px;color:#a94736;background:#fff0eb}.empty{padding:45px;text-align:center;color:#849088}@media(max-width:560px){.heading{align-items:flex-start;flex-direction:column}.message{grid-template-columns:1fr}.message b{justify-self:start}}
</style>
