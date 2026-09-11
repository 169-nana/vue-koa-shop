<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type { MerchantApplication, MerchantApplicationSubmitInput } from '../../../shared/api'
import { getMerchantApplications, submitMerchantApplication, uploadMerchantQualification } from '../api'
import { toAssetURL } from '../config'

const blank = (): MerchantApplicationSubmitInput => ({ shop_name: '', contact_name: '', contact_phone: '', description: '', qualification_picture: '' })
const applications = ref<MerchantApplication[]>([])
const form = reactive<MerchantApplicationSubmitInput>(blank())
const loading = ref(true), formOpen = ref(false), submitting = ref(false), uploading = ref(false)
const errorMessage = ref(''), successMessage = ref('')
const approvedCount = computed(() => applications.value.filter(item => item.status === 'approved').length)
const statusText: Record<MerchantApplication['status'], string> = { pending: '审核中', approved: '已通过', rejected: '已拒绝', suspended: '暂停经营', revoked: '资质已撤销' }

async function load() {
  loading.value = true; errorMessage.value = ''
  try { applications.value = (await getMerchantApplications()).applications }
  catch (error: unknown) { errorMessage.value = error instanceof Error ? error.message : '店铺申请加载失败' }
  finally { loading.value = false }
}
function newApplication() { Object.assign(form, blank()); formOpen.value = true; successMessage.value = ''; window.scrollTo({ top: 0, behavior: 'smooth' }) }
function retryApplication(item: MerchantApplication) {
  Object.assign(form, {
    id: item.id, shop_name: item.shop_name, contact_name: item.contact_name,
    contact_phone: item.contact_phone, description: item.description,
    qualification_picture: item.qualification_picture
  })
  formOpen.value = true; successMessage.value = ''; window.scrollTo({ top: 0, behavior: 'smooth' })
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
  try {
    await submitMerchantApplication({ ...form })
    successMessage.value = form.id ? '店铺资料已重新提交审核' : '新店铺申请已提交，请留意审核消息'
    formOpen.value = false; Object.assign(form, blank()); await load()
  } catch (error: unknown) { errorMessage.value = error instanceof Error ? error.message : '提交失败' }
  finally { submitting.value = false }
}
onMounted(load)
</script>

<template>
  <main class="page">
    <header><div><RouterLink to="/profile">← 返回个人中心</RouterLink><h1>我的店铺</h1><p>一个账号可以申请和管理多个独立店铺。</p></div><button class="primary" type="button" @click="newApplication">申请新店铺</button></header>
    <div class="summary"><div><strong>{{ applications.length }}</strong><span>全部店铺</span></div><div><strong>{{ approvedCount }}</strong><span>运营中</span></div><div><strong>{{ applications.length - approvedCount }}</strong><span>审核或受限</span></div></div>
    <p v-if="errorMessage" class="notice error">{{ errorMessage }}</p><p v-if="successMessage" class="notice success">{{ successMessage }}</p>

    <section v-if="formOpen" class="card form-card">
      <div class="section-heading"><div><h2>{{ form.id ? '重新提交店铺申请' : '申请新店铺' }}</h2><p>不同店铺需要分别提交经营资质。</p></div><button type="button" @click="formOpen=false">关闭</button></div>
      <form @submit.prevent="submit">
        <label>店铺名称<input v-model.trim="form.shop_name" maxlength="100" required></label>
        <div class="columns"><label>联系人<input v-model.trim="form.contact_name" maxlength="50" required></label><label>联系电话<input v-model.trim="form.contact_phone" maxlength="30" required></label></div>
        <label>店铺简介<textarea v-model.trim="form.description" maxlength="1000" rows="4" /></label>
        <label>资质图片<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" @change="upload"><small>{{ uploading ? '上传中……' : '支持 JPG、PNG、WebP、GIF，不超过500KB' }}</small></label>
        <img v-if="form.qualification_picture" class="qualification" :src="toAssetURL(form.qualification_picture)" alt="资质图片预览">
        <button class="primary" type="submit" :disabled="submitting || uploading">{{ submitting ? '提交中……' : '提交审核' }}</button>
      </form>
    </section>

    <section class="card">
      <div class="section-heading"><div><h2>店铺列表</h2><p>查看每家店铺的审核和经营状态。</p></div><span>{{ applications.length }} 家</span></div>
      <p v-if="loading" class="empty">店铺加载中……</p><p v-else-if="!applications.length" class="empty">还没有店铺，点击右上角开始申请。</p>
      <div v-else class="shop-list">
        <article v-for="item in applications" :key="item.id">
          <div class="shop-icon">{{ item.shop_name.slice(0, 1) }}</div>
          <div class="shop-main"><div><h3>{{ item.shop_name }}</h3><span class="status" :class="item.status">{{ statusText[item.status] }}</span></div><p>{{ item.description || '暂无店铺简介' }}</p><small>提交于 {{ new Date(item.submitted_at).toLocaleString() }}</small><div v-if="item.rejection_reason || item.enforcement_reason" class="reason">{{ item.enforcement_reason || item.rejection_reason }}</div></div>
          <div class="actions"><RouterLink v-if="item.status === 'approved'" class="primary small" :to="{ name: 'merchant-overview', params: { merchantId: item.id } }">进入管理</RouterLink><button v-else-if="item.status === 'rejected'" type="button" @click="retryApplication(item)">修改并重新申请</button><span v-else-if="item.status === 'pending'">等待平台审核</span><span v-else>请联系平台处理</span></div>
        </article>
      </div>
    </section>
  </main>
</template>

<style scoped>
.page{width:min(1100px,calc(100% - 32px));margin:38px auto 70px;color:#293b31}header,.section-heading{display:flex;align-items:center;justify-content:space-between;gap:20px}header a{color:#39725b}h1{margin:18px 0 6px;font-size:34px}header p,.section-heading p{margin:6px 0 0;color:#718078}.primary{display:inline-flex;padding:11px 20px;border:0!important;border-radius:999px!important;align-items:center;justify-content:center;color:white!important;background:#2d6a4f!important;cursor:pointer}.summary{display:grid;margin-top:24px;grid-template-columns:repeat(3,1fr);gap:14px}.summary div{display:flex;padding:20px 22px;align-items:end;gap:12px;border:1px solid #e1e9e3;border-radius:15px;background:white}.summary strong{font-size:28px}.summary span{padding-bottom:4px;color:#7c8981}.card{margin-top:20px;padding:26px;border:1px solid #e1e9e3;border-radius:18px;background:white;box-shadow:0 12px 36px #2645320a}.section-heading h2{margin:0}.section-heading>button,.actions button{padding:8px 13px;border:1px solid #c9d7cd;border-radius:8px;color:#35664f;background:white;cursor:pointer}.form-card form{margin-top:20px}label{display:grid;gap:8px;margin-bottom:18px;font-weight:600}input,textarea{box-sizing:border-box;width:100%;padding:12px 14px;border:1px solid #cfdbd2;border-radius:9px;font:inherit;font-weight:400}textarea{resize:vertical}.columns{display:grid;grid-template-columns:1fr 1fr;gap:18px}.qualification{width:min(320px,100%);max-height:200px;margin-bottom:18px;border-radius:10px;object-fit:contain;background:#f3f6f4}.shop-list{display:grid;gap:12px;margin-top:18px}.shop-list article{display:grid;padding:18px;align-items:center;grid-template-columns:54px minmax(0,1fr) auto;gap:16px;border:1px solid #e6ece8;border-radius:14px}.shop-icon{display:grid;width:54px;height:54px;place-items:center;border-radius:14px;color:white;background:linear-gradient(145deg,#2d6a4f,#78a187);font-size:22px;font-weight:700}.shop-main>div:first-child{display:flex;align-items:center;gap:10px}.shop-main h3{margin:0}.shop-main p{margin:7px 0;color:#718078}.shop-main small{color:#929d96}.status{padding:4px 9px;border-radius:999px;font-size:12px}.status.approved{color:#246445;background:#e6f5eb}.status.pending{color:#8d651d;background:#fff5d9}.status.rejected{color:#a54837;background:#ffebe7}.status.suspended{color:#6f7471;background:#ecefed}.reason{margin-top:9px;padding:9px 11px;border-radius:8px;color:#a54837;background:#fff2ee;font-size:13px}.actions{min-width:130px;text-align:right}.actions span{color:#8a958e;font-size:13px}.small{padding:8px 14px}.notice{padding:13px 16px;border-radius:10px}.error{color:#a94736;background:#fff0eb}.success{color:#286347;background:#ebf7ef}.empty{padding:34px;text-align:center;color:#829087}button:disabled{opacity:.55;cursor:wait}small{color:#7b8981;font-weight:400}@media(max-width:700px){header{align-items:flex-start}.summary{grid-template-columns:1fr}.columns{grid-template-columns:1fr}.shop-list article{grid-template-columns:46px 1fr}.shop-icon{width:46px;height:46px}.actions{grid-column:1/-1;text-align:left}.card{padding:18px}}
</style>
<style scoped>.status.revoked{color:#a54837;background:#ffebe7}</style>
