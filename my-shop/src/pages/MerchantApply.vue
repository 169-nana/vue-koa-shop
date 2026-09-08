<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { MerchantApplicationInput } from '../../../shared/api'
import { getMerchantApplication, submitMerchantApplication, uploadMerchantQualification } from '../api'
import { toAssetURL } from '../config'

const loading = ref(true), submitting = ref(false), uploading = ref(false), errorMessage = ref(''), successMessage = ref('')
const router = useRouter()
const application = ref<Awaited<ReturnType<typeof getMerchantApplication>>['application']>(null)
const form = reactive<MerchantApplicationInput>({ shop_name: '', contact_name: '', contact_phone: '', description: '', qualification_picture: '' })
const editable = computed(() => !application.value || application.value.status === 'rejected')
const statusText = computed(() => ({ pending: '审核中', approved: '已通过', rejected: '未通过', suspended: '已停用' }[application.value?.status ?? 'pending']))

async function load() {
  loading.value = true; errorMessage.value = ''
  try {
    application.value = (await getMerchantApplication()).application
    if (application.value) Object.assign(form, application.value)
    if (application.value?.status === 'approved') { await router.replace('/merchant'); return }
  } catch (error: unknown) { errorMessage.value = error instanceof Error ? error.message : '申请状态加载失败' }
  finally { loading.value = false }
}

async function upload(event: Event) {
  const input = event.target
  if (!(input instanceof HTMLInputElement)) return
  const file = input.files?.[0]; input.value = ''
  if (!file) return
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) || file.size > 500 * 1024) {
    errorMessage.value = '资质图片须为 JPG、PNG、WebP 或 GIF，且不超过500KB'; return
  }
  uploading.value = true; errorMessage.value = ''
  try { form.qualification_picture = (await uploadMerchantQualification(file)).savepath }
  catch (error: unknown) { errorMessage.value = error instanceof Error ? error.message : '图片上传失败' }
  finally { uploading.value = false }
}

async function submit() {
  if (submitting.value) return
  errorMessage.value = ''; successMessage.value = ''
  if (!form.shop_name.trim() || !form.contact_name.trim() || !form.contact_phone.trim() || !form.qualification_picture) {
    errorMessage.value = '请完整填写店铺名称、联系人、联系电话并上传资质图片'; return
  }
  submitting.value = true
  try { await submitMerchantApplication({ ...form }); successMessage.value = '申请已提交，请留意消息中心的审核结果'; await load() }
  catch (error: unknown) { errorMessage.value = error instanceof Error ? error.message : '提交失败' }
  finally { submitting.value = false }
}

onMounted(load)
</script>

<template>
  <main class="page"><header><RouterLink to="/profile">← 返回个人中心</RouterLink><h1>商家入驻</h1><p>提交真实资料，通过审核后即可发布商品。</p></header>
    <section v-if="loading" class="card">加载中……</section>
    <section v-else class="card">
      <div v-if="application" class="status" :class="application.status"><strong>{{ statusText }}</strong><span>提交时间：{{ new Date(application.submitted_at).toLocaleString() }}</span></div>
      <div v-if="application?.rejection_reason" class="reason"><strong>审核意见</strong><p>{{ application.rejection_reason }}</p></div>
      <div v-if="application?.status === 'approved'" class="approved"><p>商家资格已经生效。</p><RouterLink class="primary" to="/merchant">进入商家中心</RouterLink></div>
      <form v-else @submit.prevent="submit">
        <label>店铺名称<input v-model.trim="form.shop_name" :disabled="!editable" maxlength="100" required></label>
        <div class="columns"><label>联系人<input v-model.trim="form.contact_name" :disabled="!editable" maxlength="50" required></label><label>联系电话<input v-model.trim="form.contact_phone" :disabled="!editable" maxlength="30" required></label></div>
        <label>店铺简介<textarea v-model.trim="form.description" :disabled="!editable" maxlength="1000" rows="5" /></label>
        <label>资质图片<input v-if="editable" type="file" accept="image/jpeg,image/png,image/webp,image/gif" @change="upload"><small>{{ uploading ? '上传中……' : '支持 JPG、PNG、WebP、GIF，不超过500KB' }}</small></label>
        <img v-if="form.qualification_picture" class="qualification" :src="toAssetURL(form.qualification_picture)" alt="资质图片预览">
        <p v-if="errorMessage" class="error">{{ errorMessage }}</p><p v-if="successMessage" class="success">{{ successMessage }}</p>
        <button v-if="editable" class="primary" type="submit" :disabled="submitting || uploading">{{ submitting ? '提交中……' : application ? '重新提交审核' : '提交申请' }}</button>
      </form>
    </section>
  </main>
</template>

<style scoped>
.page { width: min(820px, calc(100% - 32px)); margin: 42px auto 70px; color: #293b31; } header { margin-bottom: 24px; } header a { color: #39725b; } h1 { margin: 24px 0 8px; font-size: 34px; } header p { color: #708078; }.card { padding: 32px; border: 1px solid #e1e9e3; border-radius: 20px; background: white; box-shadow: 0 14px 45px #2645320d; }label { display: grid; gap: 8px; margin-bottom: 20px; font-weight: 600; }input, textarea { box-sizing: border-box; width: 100%; padding: 12px 14px; border: 1px solid #cfdbd2; border-radius: 9px; font: inherit; font-weight: 400; }textarea { resize: vertical; }.columns { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }.qualification { width: min(320px, 100%); max-height: 220px; margin-bottom: 20px; border-radius: 10px; object-fit: contain; background: #f3f6f4; }.primary { display: inline-block; padding: 12px 22px; border: 0; border-radius: 999px; color: white; background: #2d6a4f; cursor: pointer; }.status { display: flex; justify-content: space-between; margin-bottom: 22px; padding: 14px 18px; border-radius: 10px; background: #f3f6f4; }.status.pending { color: #9a6718; background: #fff8df; }.status.rejected, .reason { color: #a54736; background: #fff0ec; }.status.approved { color: #2d6a4f; background: #eaf5ee; }.reason { margin-bottom: 22px; padding: 16px; border-radius: 10px; }.reason p { margin-bottom: 0; white-space: pre-wrap; }.error { color: #b34838; }.success { color: #2d6a4f; }small { color: #7b8981; font-weight: 400; }button:disabled { opacity: .6; cursor: wait; }@media(max-width:600px){.columns{grid-template-columns:1fr}.card{padding:22px}.status{gap:8px;flex-direction:column}}
</style>
