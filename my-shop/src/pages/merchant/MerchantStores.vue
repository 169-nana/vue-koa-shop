<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import type { MerchantApplication, MerchantApplicationSubmitInput } from '../../../../shared/api'
import { getMerchantApplications, submitMerchantApplication, uploadMerchantQualification } from '../../api'
import { toAssetURL } from '../../config'

const blank = (): MerchantApplicationSubmitInput => ({ shop_name: '', contact_name: '', contact_phone: '', description: '', qualification_picture: '' })
const route = useRoute()
const currentMerchantId = computed(() => Number(route.params.merchantId))
const applications = ref<MerchantApplication[]>([])
const form = reactive<MerchantApplicationSubmitInput>(blank())
const loading = ref(true), formOpen = ref(false), submitting = ref(false), uploading = ref(false)
const errorMessage = ref(''), successMessage = ref('')
const statusText: Record<MerchantApplication['status'], string> = { pending: '审核中', approved: '已通过', rejected: '已拒绝', suspended: '暂停经营', revoked: '资质已撤销' }
async function load() {
  loading.value = true; errorMessage.value = ''
  try { applications.value = (await getMerchantApplications()).applications }
  catch (error: unknown) { errorMessage.value = error instanceof Error ? error.message : '店铺加载失败' }
  finally { loading.value = false }
}
function newApplication() { Object.assign(form, blank()); formOpen.value = true; successMessage.value = '' }
function retry(item: MerchantApplication) {
  Object.assign(form, { id: item.id, shop_name: item.shop_name, contact_name: item.contact_name, contact_phone: item.contact_phone, description: item.description, qualification_picture: item.qualification_picture })
  formOpen.value = true; successMessage.value = ''
}
async function upload(event: Event) {
  const input = event.target; if (!(input instanceof HTMLInputElement)) return
  const file = input.files?.[0]; input.value = ''; if (!file) return
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) || file.size > 500 * 1024) { errorMessage.value = '资质图片格式不支持或超过500KB'; return }
  uploading.value = true; errorMessage.value = ''
  try { form.qualification_picture = (await uploadMerchantQualification(file)).savepath }
  catch (error: unknown) { errorMessage.value = error instanceof Error ? error.message : '图片上传失败' }
  finally { uploading.value = false }
}
async function submit() {
  if (submitting.value) return
  errorMessage.value = ''; successMessage.value = ''
  if (!form.shop_name.trim() || !form.contact_name.trim() || !form.contact_phone.trim() || !form.qualification_picture) { errorMessage.value = '请完整填写店铺名称、联系人、联系电话并上传资质图片'; return }
  submitting.value = true
  try {
    await submitMerchantApplication({ ...form })
    successMessage.value = form.id ? '店铺资料已重新提交审核' : '新店铺申请已提交'
    formOpen.value = false; Object.assign(form, blank()); await load()
  } catch (error: unknown) { errorMessage.value = error instanceof Error ? error.message : '提交失败' }
  finally { submitting.value = false }
}
onMounted(load)
</script>

<template>
  <div>
    <div class="heading"><div><p>STORES</p><h1>店铺管理</h1><span>在当前管理台内查看和申请多个店铺。</span></div><button class="primary" type="button" @click="newApplication">申请新店铺</button></div>
    <p v-if="errorMessage" class="notice error">{{ errorMessage }}</p><p v-if="successMessage" class="notice success">{{ successMessage }}</p>
    <section v-if="formOpen" class="panel form-panel"><div class="section-heading"><div><h2>{{ form.id ? '重新提交申请' : '申请新店铺' }}</h2><p>不同店铺需要分别提交经营资质。</p></div><button type="button" @click="formOpen=false">关闭</button></div><form @submit.prevent="submit"><div class="form-grid"><label>店铺名称<input v-model.trim="form.shop_name" maxlength="100" required></label><label>联系人<input v-model.trim="form.contact_name" maxlength="50" required></label><label>联系电话<input v-model.trim="form.contact_phone" maxlength="30" required></label><label>资质图片<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" @change="upload"></label></div><label>店铺简介<textarea v-model.trim="form.description" maxlength="1000" rows="2" /></label><div class="form-actions"><img v-if="form.qualification_picture" :src="toAssetURL(form.qualification_picture)" alt="资质预览"><span>{{ uploading ? '图片上传中……' : '图片不超过500KB' }}</span><button class="primary" type="submit" :disabled="submitting || uploading">{{ submitting ? '提交中……' : '提交审核' }}</button></div></form></section>
    <section class="panel"><div class="section-heading"><div><h2>全部店铺</h2><p>审核状态与店铺入口集中管理。</p></div><span>{{ applications.length }} 家</span></div><p v-if="loading" class="empty">店铺加载中……</p><p v-else-if="!applications.length" class="empty">还没有店铺</p><div v-else class="shop-list"><article v-for="item in applications" :key="item.id" :class="{ current: item.id === currentMerchantId }"><div class="shop-icon">{{ item.shop_name.slice(0,1) }}</div><div class="shop-main"><div><strong>{{ item.shop_name }}</strong><span :class="item.status">{{ statusText[item.status] }}</span><em v-if="item.id === currentMerchantId">当前店铺</em></div><p>{{ item.description || '暂无店铺简介' }}</p><small v-if="item.rejection_reason || item.enforcement_reason">{{ item.enforcement_reason || item.rejection_reason }}</small></div><div class="actions"><RouterLink v-if="item.status === 'approved'" :to="{ name: 'merchant-overview', params: { merchantId: item.id } }">进入管理</RouterLink><button v-else-if="item.status === 'rejected'" type="button" @click="retry(item)">修改后重提</button><span v-else>{{ item.status === 'pending' ? '等待审核' : '联系平台' }}</span></div></article></div></section>
  </div>
</template>

<style scoped>
.heading,.section-heading{display:flex;align-items:center;justify-content:space-between;gap:20px}.heading>div>p{margin:0 0 7px;color:#809087;font-size:10px;font-weight:700;letter-spacing:.2em}.heading h1{margin:0;font-size:30px}.heading span,.section-heading p{display:block;margin:7px 0 0;color:#78867e;font-size:13px}.primary{padding:10px 17px!important;border:0!important;border-radius:999px!important;color:white!important;background:#2d6a4f!important;cursor:pointer}.panel{margin-top:18px;padding:20px;border:1px solid #e0e7e2;border-radius:16px;background:white}.section-heading h2{margin:0;font-size:18px}.section-heading>button,.actions button{padding:7px 11px;border:1px solid #cbd8cf;border-radius:7px;color:#35664f;background:white;cursor:pointer}.form-panel form{margin-top:14px}.form-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}label{display:grid;gap:5px;margin:9px 0;color:#42564a;font-size:13px;font-weight:600}input,textarea{box-sizing:border-box;width:100%;padding:9px 10px;border:1px solid #cfdbd2;border-radius:8px;font:inherit;font-weight:400}.form-actions{display:flex;align-items:center;justify-content:flex-end;gap:12px;color:#849088;font-size:12px}.form-actions img{width:50px;height:50px;margin-right:auto;border-radius:7px;object-fit:cover}.shop-list{display:grid;gap:9px;margin-top:15px}.shop-list article{display:grid;padding:13px;align-items:center;grid-template-columns:45px minmax(0,1fr) auto;gap:13px;border:1px solid #e6ece8;border-radius:11px}.shop-list article.current{border-color:#bcd3c4;background:#f7faf8}.shop-icon{display:grid;width:45px;height:45px;place-items:center;border-radius:11px;color:white;background:#4f7d65;font-weight:700}.shop-main>div{display:flex;align-items:center;gap:8px}.shop-main p{margin:5px 0;color:#718078;font-size:13px}.shop-main small{color:#a54837}.shop-main span,.shop-main em{padding:3px 7px;border-radius:999px;font-size:10px;font-style:normal}.approved{color:#246445;background:#e6f5eb}.pending{color:#8d651d;background:#fff5d9}.rejected{color:#a54837;background:#ffebe7}.suspended{color:#6f7471;background:#ecefed}.shop-main em{color:#35664f;background:#e6eee9}.actions a{color:#2d6a4f;font-size:13px}.actions span{color:#8a958e;font-size:12px}.notice{padding:11px 14px;border-radius:9px}.error{color:#a94736;background:#fff0eb}.success{color:#286347;background:#ebf7ef}.empty{padding:35px;text-align:center;color:#849088}button:disabled{opacity:.55}@media(max-width:900px){.form-grid{grid-template-columns:1fr 1fr}}@media(max-width:560px){.heading{align-items:flex-start;flex-direction:column}.form-grid{grid-template-columns:1fr}.shop-list article{grid-template-columns:40px 1fr}.actions{grid-column:2}}
</style>
<style scoped>.revoked{color:#a54837;background:#ffebe7}</style>
