<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Category, GoodsSubmissionInput, MerchantApplication } from '../../../../shared/api'
import { getCategories, getMerchantApplications, getMerchantGoods, getMerchantSubmissions, saveMerchantSubmission, submitMerchantGoods, uploadMerchantGoodsImage } from '../../api'
import { toAssetURL } from '../../config'

type FormState = Omit<GoodsSubmissionInput, 'price' | 'stock' | 'category_id'> & { price: number | undefined; stock: number | undefined; category_id: number | undefined }
const blank = (): FormState => ({ name: '', category_id: undefined, price: undefined, stock: undefined, picture: '', album: [], spec: '', description: '' })
const route = useRoute(), router = useRouter()
const merchantId = computed(() => Number(route.params.merchantId))
const form = reactive<FormState>(blank())
const categories = ref<Category[]>([])
const shops = ref<MerchantApplication[]>([])
const loading = ref(true), saving = ref(false), uploading = ref(false), errorMessage = ref('')
const leafCategories = computed(() => categories.value.filter(item => item.pid !== 0))
const title = computed(() => form.goods_id ? '提交商品修改' : form.id ? '编辑商品草稿' : '发布新商品')
const currentShop = computed(() => shops.value.find(item => item.id === merchantId.value) ?? null)
const shopLocked = computed(() => Boolean(form.id || form.goods_id))

async function load() {
  loading.value = true; errorMessage.value = ''; Object.assign(form, blank())
  try {
    const [categoryList, submissions, goods, applications] = await Promise.all([getCategories(), getMerchantSubmissions(merchantId.value), getMerchantGoods(merchantId.value), getMerchantApplications()])
    categories.value = categoryList
    shops.value = applications.applications.filter(item => item.status === 'approved')
    const submissionId = Number(route.query.submission_id)
    const goodsId = Number(route.query.goods_id)
    const submission = Number.isInteger(submissionId) && submissionId > 0 ? submissions.find(item => item.id === submissionId && (item.status === 'draft' || item.status === 'rejected')) : undefined
    const product = Number.isInteger(goodsId) && goodsId > 0 ? goods.find(item => item.id === goodsId) : undefined
    if (submission) Object.assign(form, { id: submission.id, goods_id: submission.goods_id ?? undefined, name: submission.name, category_id: submission.category_id, price: submission.price, stock: submission.stock, picture: submission.picture, album: [...submission.album], spec: submission.spec, description: submission.description })
    else if (product) {
      const previous = submissions.find(item => item.goods_id === product.id && item.status === 'approved')
      Object.assign(form, { goods_id: product.id, name: product.name, category_id: product.category_id, price: product.price, stock: product.stock, picture: product.picture, album: previous ? [...previous.album] : [], spec: product.spec, description: product.description })
    } else if (route.query.submission_id || route.query.goods_id) errorMessage.value = '没有找到可编辑的商品资料'
  } catch (error: unknown) { errorMessage.value = error instanceof Error ? error.message : '商品资料加载失败' }
  finally { loading.value = false }
}
function hasUnsavedInput() {
  return Boolean(form.name || form.category_id !== undefined || form.price !== undefined || form.stock !== undefined || form.picture || form.album.length || form.spec || form.description)
}
async function switchShop(event: Event) {
  const select = event.target
  if (!(select instanceof HTMLSelectElement)) return
  const nextId = Number(select.value)
  if (!Number.isInteger(nextId) || nextId === merchantId.value || shopLocked.value || saving.value || uploading.value) return
  if (hasUnsavedInput() && !window.confirm('切换店铺将清空当前未保存的商品资料，是否继续？')) {
    select.value = String(merchantId.value)
    return
  }
  await router.push({ name: 'merchant-product-new', params: { merchantId: nextId } })
}
function validImage(file: File) { return ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) && file.size <= 500 * 1024 }
async function uploadMain(event: Event) {
  const input = event.target; if (!(input instanceof HTMLInputElement)) return
  const file = input.files?.[0]; input.value = ''; if (!file) return
  if (!validImage(file)) { errorMessage.value = '图片格式不支持或超过500KB'; return }
  uploading.value = true
  try { form.picture = (await uploadMerchantGoodsImage(merchantId.value, file, 'goods_picture')).savepath }
  catch (error: unknown) { errorMessage.value = error instanceof Error ? error.message : '图片上传失败' }
  finally { uploading.value = false }
}
async function uploadAlbum(event: Event) {
  const input = event.target; if (!(input instanceof HTMLInputElement)) return
  const files = [...(input.files ?? [])]; input.value = ''
  if (!files.length) return
  if (form.album.length + files.length > 20 || files.some(file => !validImage(file))) { errorMessage.value = '相册最多20张，每张不超过500KB'; return }
  uploading.value = true
  try { for (const file of files) form.album.push((await uploadMerchantGoodsImage(merchantId.value, file, 'goods_album')).savepath) }
  catch (error: unknown) { errorMessage.value = error instanceof Error ? error.message : '相册上传失败' }
  finally { uploading.value = false }
}
async function save(submitAfterSave: boolean) {
  if (saving.value) return
  errorMessage.value = ''
  if (!form.name.trim() || form.category_id === undefined || form.price === undefined || form.stock === undefined || !form.picture) { errorMessage.value = '请完整填写名称、分类、价格、库存和主图'; return }
  saving.value = true
  try {
    const result = await saveMerchantSubmission(merchantId.value, { ...form, category_id: form.category_id, price: form.price, stock: form.stock, album: [...form.album] })
    if (submitAfterSave) await submitMerchantGoods(merchantId.value, result.insertId)
    await router.push({ name: 'merchant-submissions', params: { merchantId: merchantId.value }, query: { status: submitAfterSave ? 'pending' : 'draft', saved: '1' } })
  } catch (error: unknown) { errorMessage.value = error instanceof Error ? error.message : '保存失败' }
  finally { saving.value = false }
}
watch(() => [route.query.submission_id, route.query.goods_id, merchantId.value], load)
onMounted(load)
</script>

<template>
  <div>
    <div class="heading"><div><p>PRODUCT EDITOR</p><h1>{{ title }}</h1><span>商品资料保存为草稿后，可随时提交平台审核。</span></div><RouterLink :to="{ name: 'merchant-products', params: { merchantId } }">返回商品管理</RouterLink></div>
    <p v-if="errorMessage" class="notice">{{ errorMessage }}</p>
    <section v-if="loading" class="panel empty">商品资料加载中……</section>
    <form v-else class="panel compact-form" @submit.prevent="save(false)">
      <section class="publish-target"><div><span>发布店铺</span><strong>{{ currentShop?.shop_name || '当前店铺' }}</strong><small>{{ shopLocked ? '商品或审核稿所属店铺不可修改' : '商品审核通过后将在该店铺上架' }}</small></div><select v-if="shops.length > 1 && !shopLocked" :value="merchantId" :disabled="saving || uploading" aria-label="选择发布店铺" @change="switchShop"><option v-for="shop in shops" :key="shop.id" :value="shop.id">{{ shop.shop_name }}</option></select><span v-else class="target-state">{{ shopLocked ? '店铺已锁定' : '当前仅有一家可用店铺' }}</span></section>
      <div class="form-layout"><div class="editor-column"><div class="form-section"><h2>基础信息</h2><div class="grid"><label>商品名称<input v-model.trim="form.name" maxlength="255" required></label><label>商品分类<select v-model="form.category_id" required><option :value="undefined" disabled>请选择二级分类</option><option v-for="item in leafCategories" :key="item.id" :value="item.id">{{ item.name }}</option></select></label><label>销售价格<input v-model.number="form.price" type="number" min="0" step="0.01" required></label><label>{{ form.goods_id ? '当前库存（审核不修改）' : '初始库存' }}<input v-model.number="form.stock" type="number" min="0" step="1" required></label></div><label>商品规格<input v-model.trim="form.spec" maxlength="255" placeholder="例如：红色，蓝色"></label></div><div class="form-section description"><h2>商品介绍</h2><label>文字说明<textarea v-model.trim="form.description" rows="5" maxlength="10000" placeholder="介绍商品特点、材质和使用方式" /></label></div></div>
      <div class="form-section media-section"><h2>图片资料</h2><div class="uploads"><label>商品主图<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" @change="uploadMain"><small>正方形，不超过500KB</small></label><label>商品相册<input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" @change="uploadAlbum"><small>最多20张，单张500KB内</small></label></div><div class="pictures"><div v-if="form.picture"><img :src="toAssetURL(form.picture)" alt="商品主图"><b>主图</b></div><button v-for="(picture,index) in form.album" :key="picture" type="button" @click="form.album.splice(index,1)"><img :src="toAssetURL(picture)" alt="相册图"><span>移除</span></button></div><p v-if="!form.picture" class="picture-empty">上传主图后会在这里预览</p></div></div>
      <footer><span>{{ uploading ? '图片上传中，请稍候……' : '保存草稿不会进入审核流程' }}<b>提交到：{{ currentShop?.shop_name || '当前店铺' }}</b></span><div><button type="submit" :disabled="saving || uploading">保存草稿</button><button class="primary" type="button" :disabled="saving || uploading" @click="save(true)">{{ saving ? '处理中……' : '保存并提交审核' }}</button></div></footer>
    </form>
  </div>
</template>

<style scoped>
.heading{display:flex;align-items:end;justify-content:space-between;gap:20px}.heading>div>p{margin:0 0 7px;color:#809087;font-size:10px;font-weight:700;letter-spacing:.2em}.heading h1{margin:0;font-size:30px}.heading span{display:block;margin-top:7px;color:#78867e;font-size:13px}.heading>a{color:#2d6a4f;font-size:13px}.panel{margin-top:20px;padding:25px 27px;border:1px solid #e0e7e2;border-radius:17px;background:white}.compact-form{box-sizing:border-box}.publish-target{display:flex;margin:-4px 0 25px;padding:15px 17px;align-items:center;justify-content:space-between;gap:20px;border:1px solid #d9e5dc;border-radius:12px;background:#f6faf7}.publish-target>div>span,.publish-target strong,.publish-target small{display:block}.publish-target>div>span{margin-bottom:3px;color:#7c8d83;font-size:11px}.publish-target strong{font-size:16px}.publish-target small{margin-top:4px;color:#829087}.publish-target select{width:min(280px,40%);padding:10px 34px 10px 12px;border:1px solid #bfd1c4;border-radius:8px;background:white;font:inherit}.target-state{padding:7px 11px;border-radius:999px;color:#718078;background:#eaf1ec;font-size:12px}.form-layout{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(320px,.8fr);gap:30px}.form-section{min-width:0}.description{margin-top:20px;padding-top:20px;border-top:1px solid #edf0ee}.media-section{padding-left:29px;border-left:1px solid #edf0ee}.form-section h2{margin:0 0 14px;font-size:18px}.grid,.uploads{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}.uploads{grid-template-columns:1fr}label{display:grid;gap:7px;margin:13px 0;color:#42564a;font-size:14px;font-weight:600}input,select,textarea{box-sizing:border-box;width:100%;padding:11px 12px;border:1px solid #cfdbd2;border-radius:8px;font:inherit;font-weight:400}textarea{resize:vertical;line-height:1.6}label small{color:#8a958e;font-size:11px;font-weight:400}.pictures{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}.pictures>div,.pictures>button{position:relative;width:82px;height:82px;padding:0;overflow:hidden;border:0;border-radius:9px;background:#edf1ee}.pictures img{width:100%;height:100%;object-fit:cover}.pictures b,.pictures span{position:absolute;right:0;bottom:0;left:0;padding:5px;color:white;background:#0009;font-size:10px}.pictures button{cursor:pointer}.picture-empty{display:grid;height:105px;margin:16px 0 0;place-items:center;border:1px dashed #d7e0da;border-radius:9px;color:#96a099;font-size:12px}.panel footer{display:flex;padding-top:20px;margin-top:22px;align-items:center;justify-content:space-between;gap:15px;border-top:1px solid #edf0ee}.panel footer>span{color:#849088;font-size:12px}.panel footer>span b{display:block;margin-top:5px;color:#35664f}.panel footer>div{display:flex;gap:9px}.panel footer button{padding:10px 17px;border:1px solid #cad7ce;border-radius:9px;color:#35664f;background:white;cursor:pointer}.panel footer .primary{border:0;color:white;background:#2d6a4f}.notice{padding:12px 15px;border-radius:9px;color:#a94736;background:#fff0eb}.empty{padding:50px;text-align:center;color:#849088}button:disabled,select:disabled{opacity:.55;cursor:wait}@media(max-width:1000px){.form-layout{grid-template-columns:1fr}.media-section{padding:20px 0 0;border-top:1px solid #edf0ee;border-left:0}.uploads{grid-template-columns:1fr 1fr}}@media(max-width:650px){.heading{align-items:flex-start;flex-direction:column}.publish-target{align-items:stretch;flex-direction:column}.publish-target select{width:100%}.grid,.uploads{grid-template-columns:1fr}.panel{padding:18px}.panel footer{align-items:flex-start;flex-direction:column}.panel footer>div{width:100%}.panel footer button{flex:1}}
</style>
