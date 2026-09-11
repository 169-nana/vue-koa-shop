<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getMerchantApplications } from '../api'

const router = useRouter()
const errorMessage = ref('')

async function enter() {
  errorMessage.value = ''
  try {
    const { applications } = await getMerchantApplications()
    const approved = applications.find(item => item.status === 'approved')
    const restricted = applications.find(item => item.status === 'suspended' || item.status === 'revoked')
    await router.replace(approved
      ? { name: 'merchant-overview', params: { merchantId: approved.id } }
      : restricted
        ? { name: 'merchant-stores', params: { merchantId: restricted.id } }
        : { name: 'merchant-apply' })
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : '商家服务加载失败'
  }
}

onMounted(enter)
</script>

<template>
  <main class="gateway"><section><p v-if="!errorMessage">正在进入商家服务……</p><template v-else><p class="error">{{ errorMessage }}</p><button type="button" @click="enter">重新加载</button><RouterLink to="/profile">返回个人中心</RouterLink></template></section></main>
</template>

<style scoped>
.gateway{display:grid;min-height:70vh;place-items:center;color:#53675b}.gateway section{text-align:center}.error{color:#ad4938}.gateway button,.gateway a{display:inline-block;margin:10px 5px;padding:10px 18px;border:1px solid #bed0c3;border-radius:999px;color:#2d6a4f;background:white;cursor:pointer}
</style>
