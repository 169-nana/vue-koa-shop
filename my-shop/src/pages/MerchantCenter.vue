<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type { Category, GoodsSubmission, GoodsSubmissionInput, MerchantGoodsItem } from '../../../shared/api'
import {
  getCategories, getMerchantApplication, getMerchantGoods, getMerchantSubmissions,
  saveMerchantSubmission, submitMerchantGoods, updateMerchantSaleStatus,
  updateMerchantStock, uploadMerchantGoodsImage
} from '../api'
import { toAssetURL } from '../config'

type FormState = Omit<GoodsSubmissionInput, 'price' | 'stock' | 'category_id'> & {
  price: number | undefined; stock: number | undefined; category_id: number | undefined
}
const blank = (): FormState => ({ name: '', category_id: undefined, price: undefined, stock: undefined, picture: '', album: [], spec: '', description: '' })
const application = ref<Awaited<ReturnType<typeof getMerchantApplication>>['application']>(null)
const submissions = ref<GoodsSubmission[]>([]), goods = ref<MerchantGoodsItem[]>([]), categories = ref<Category[]>([])
const form = reactive<FormState>(blank()), editing = ref(false), loading = ref(true), saving = ref(false), uploading = ref(false)
const errorMessage = ref(''), successMessage = ref('')
const leafCategories = computed(() => categories.value.filter(item => item.pid !== 0))
const statusText: Record<GoodsSubmission['status'], string> = { draft: '草稿', pending: '审核中', approved: '已通过', rejected: '未通过' }

async function load() {
  loading.value = true; errorMessage.value = ''
  try {
    const [state, submissionList, goodsList, categoryList] = await Promise.all([
      getMerchantApplication(), getMerchantSubmissions(), getMerchantGoods(), getCategories()
    ])
    application.value = state.application; submissions.value = submissionList; goods.value = goodsList; categories.value = categoryList
  } catch (error: unknown) { errorMessage.value = error instanceof Error ? error.message : '商家中心加载失败' }
  finally { loading.value = false }
}

function newGoods() { Object.assign(form, blank()); editing.value = true; successMessage.value = ''; window.scrollTo({ top: 0, behavior: 'smooth' }) }
function editSubmission(item: GoodsSubmission, asUpdate = false) {
  Object.assign(form, {
    id: asUpdate ? undefined : item.id, goods_id: asUpdate ? (item.goods_id ?? undefined) : (item.goods_id ?? undefined),
    name: item.name, category_id: item.category_id, price: item.price, stock: item.stock,
    picture: item.picture, album: [...item.album], spec: item.spec, description: item.description
  })
  editing.value = true; successMessage.value = ''; window.scrollTo({ top: 0, behavior: 'smooth' })
}

function validImage(file: File) { return ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) && file.size <= 500 * 1024 }
async function uploadMain(event: Event) {
  const input = event.target; if (!(input instanceof HTMLInputElement)) return
  const file = input.files?.[0]; input.value = ''; if (!file) return
  if (!validImage(file)) { errorMessage.value = '图片格式不支持或超过500KB'; return }
  uploading.value = true
  try { form.picture = (await uploadMerchantGoodsImage(file, 'goods_picture')).savepath }
  catch (error: unknown) { errorMessage.value = error instanceof Error ? error.message : '图片上传失败' }
  finally { uploading.value = false }
}
async function uploadAlbum(event: Event) {
  const input = event.target; if (!(input instanceof HTMLInputElement)) return
  const files = [...(input.files ?? [])]; input.value = ''
  if (!files.length) return
  if (form.album.length + files.length > 20 || files.some(file => !validImage(file))) { errorMessage.value = '相册最多20张，每张不超过500KB'; return }
  uploading.value = true
  try { for (const file of files) form.album.push((await uploadMerchantGoodsImage(file, 'goods_album')).savepath) }
  catch (error: unknown) { errorMessage.value = error instanceof Error ? error.message : '相册上传失败' }
  finally { uploading.value = false }
}

async function saveDraft(submitAfterSave = false) {
  if (saving.value) return
  errorMessage.value = ''; successMessage.value = ''
  if (!form.name.trim() || form.category_id === undefined || form.price === undefined || form.stock === undefined || !form.picture) {
    errorMessage.value = '请完整填写名称、分类、价格、库存和主图'; return
  }
  saving.value = true
  let savedId: number | null = null
  try {
    const result = await saveMerchantSubmission({ ...form, category_id: form.category_id, price: form.price, stock: form.stock, album: [...form.album] })
    savedId = result.insertId
    if (submitAfterSave) await submitMerchantGoods(savedId)
    successMessage.value = submitAfterSave ? '商品已保存并提交审核' : '草稿已保存，可以在列表中提交审核'
    editing.value = false
    await load()
    const saved = submissions.value.find(item => item.id === result.insertId)
    if (saved && !submitAfterSave) saved.status = 'draft'
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '操作失败'
    errorMessage.value = savedId ? `草稿已保存，但提交审核失败：${message}` : message
    if (savedId) { form.id = savedId; await load() }
  }
  finally { saving.value = false }
}
async function submitReview(item: GoodsSubmission) {
  errorMessage.value = ''; try { await submitMerchantGoods(item.id); successMessage.value = `“${item.name}”已提交审核`; await load() }
  catch (error: unknown) { errorMessage.value = error instanceof Error ? error.message : '提交失败' }
}
async function saveStock(item: MerchantGoodsItem) {
  try { await updateMerchantStock({ id: item.id, stock: item.stock }); successMessage.value = `“${item.name}”库存已更新` }
  catch (error: unknown) { errorMessage.value = error instanceof Error ? error.message : '库存更新失败'; await load() }
}
async function toggleSale(item: MerchantGoodsItem) {
  const next = item.sale_status === 'on_sale' ? 'off_sale' : 'on_sale'
  try { await updateMerchantSaleStatus({ id: item.id, sale_status: next }); item.sale_status = next }
  catch (error: unknown) { errorMessage.value = error instanceof Error ? error.message : '上下架失败' }
}
onMounted(load)
</script>

<template>
  <main class="page"><header><div><RouterLink to="/profile">← 返回个人中心</RouterLink><h1>{{ application?.shop_name || '商家中心' }}</h1><p>商品内容提交审核后发布，库存和上下架可以随时调整。</p></div><button class="primary" @click="newGoods">提交新商品</button></header>
    <p v-if="errorMessage" class="notice error">{{ errorMessage }}</p><p v-if="successMessage" class="notice success">{{ successMessage }}</p>
    <section v-if="editing" class="panel form-panel"><div class="panel-heading"><h2>{{ form.goods_id ? '提交商品修改' : form.id ? '修改草稿' : '新商品草稿' }}</h2><button @click="editing=false">关闭</button></div>
      <form @submit.prevent="saveDraft(false)"><div class="grid"><label>商品名称<input v-model.trim="form.name" maxlength="255" required></label><label>分类<select v-model="form.category_id" required><option :value="undefined" disabled>请选择二级分类</option><option v-for="item in leafCategories" :key="item.id" :value="item.id">{{ item.name }}</option></select></label><label>价格<input v-model.number="form.price" type="number" min="0" step="0.01" required></label><label>{{ form.goods_id ? '当前库存（内容审核不会修改）' : '初始库存' }}<input v-model.number="form.stock" type="number" min="0" step="1" required></label></div>
        <label>商品规格<input v-model.trim="form.spec" maxlength="255" placeholder="例如：红色，蓝色"></label><label>商品介绍<textarea v-model.trim="form.description" rows="5" maxlength="10000" /></label>
        <div class="uploads"><label>商品主图<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" @change="uploadMain"></label><label>商品相册<input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" @change="uploadAlbum"></label></div>
        <div class="pictures"><img v-if="form.picture" :src="toAssetURL(form.picture)" alt="商品主图"><button v-for="(picture,index) in form.album" :key="picture" type="button" @click="form.album.splice(index,1)"><img :src="toAssetURL(picture)" alt="相册图"><span>移除</span></button></div>
        <div class="submit-actions"><button type="submit" :disabled="saving || uploading">保存草稿</button><button class="primary" type="button" :disabled="saving || uploading" @click="saveDraft(true)">{{ saving ? '处理中……' : uploading ? '上传中……' : '保存并提交审核' }}</button></div>
      </form>
    </section>
    <section v-if="loading" class="panel">加载中……</section><template v-else>
      <section class="panel"><div class="panel-heading"><h2>商品审核</h2><span>{{ submissions.length }} 条提交</span></div><p v-if="!submissions.length" class="empty">还没有商品草稿</p><div v-else class="cards"><article v-for="item in submissions" :key="item.id"><img :src="toAssetURL(item.picture)" alt=""><div><strong>{{ item.name }}</strong><p>¥{{ item.price.toFixed(2) }} · {{ statusText[item.status] }}</p><small v-if="item.rejection_reason">{{ item.rejection_reason }}</small></div><div class="actions"><button v-if="item.status === 'draft' || item.status === 'rejected'" @click="editSubmission(item)">编辑</button><button v-if="item.status === 'draft' || item.status === 'rejected'" class="primary small" @click="submitReview(item)">提交审核</button><button v-if="item.status === 'approved' && item.goods_id" @click="editSubmission(item,true)">提交修改</button></div></article></div></section>
      <section class="panel"><div class="panel-heading"><h2>在售商品管理</h2><span>{{ goods.length }} 件商品</span></div><p v-if="!goods.length" class="empty">暂无审核通过的商品</p><div v-else class="cards"><article v-for="item in goods" :key="item.id"><img :src="toAssetURL(item.picture)" alt=""><div><strong>{{ item.name }}</strong><p>¥{{ item.price.toFixed(2) }} · {{ item.sale_status === 'on_sale' ? '已上架' : '已下架' }}</p></div><div class="stock"><input v-model.number="item.stock" type="number" min="0" step="1"><button @click="saveStock(item)">保存库存</button><button @click="toggleSale(item)">{{ item.sale_status === 'on_sale' ? '下架' : '上架' }}</button></div></article></div></section>
    </template>
  </main>
</template>

<style scoped>
.page { width: min(1100px, calc(100% - 32px)); margin: 38px auto 70px; color: #293b31; }header,.panel-heading { display:flex;align-items:center;justify-content:space-between;gap:20px }header a{color:#39725b}h1{margin:18px 0 6px;font-size:34px}header p{color:#718078}.panel{margin-top:22px;padding:26px;border:1px solid #e1e9e3;border-radius:18px;background:white}.panel h2{margin:0}.panel-heading>button,.actions button,.stock button,.submit-actions>button{padding:8px 13px;border:1px solid #c9d7cd;border-radius:8px;background:white;color:#35664f;cursor:pointer}.primary{padding:11px 20px;border:0!important;border-radius:999px!important;color:white!important;background:#2d6a4f!important;cursor:pointer}.small{padding:8px 13px}.submit-actions{display:flex;gap:10px;align-items:center}.grid,.uploads{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}label{display:grid;gap:7px;margin:18px 0;font-weight:600}input,select,textarea{box-sizing:border-box;width:100%;padding:11px 12px;border:1px solid #cfdbd2;border-radius:8px;font:inherit;font-weight:400}textarea{resize:vertical}.pictures{display:flex;gap:10px;flex-wrap:wrap;margin:4px 0 20px}.pictures>img,.pictures button{width:90px;height:90px}.pictures img{width:100%;height:100%;border-radius:8px;object-fit:cover}.pictures button{position:relative;padding:0;border:0;background:none}.pictures button span{position:absolute;right:0;bottom:0;left:0;padding:4px;color:white;background:#0009}.cards{display:grid;gap:12px;margin-top:18px}.cards article{display:grid;grid-template-columns:64px minmax(0,1fr) auto;align-items:center;gap:16px;padding:14px;border:1px solid #e8eee9;border-radius:12px}.cards article>img{width:64px;height:64px;border-radius:8px;object-fit:cover}.cards p{margin:7px 0;color:#718078}.cards small{display:block;max-width:650px;color:#b34d3b;line-height:1.5}.actions,.stock{display:flex;align-items:center;gap:8px}.stock input{width:90px}.notice{padding:13px 16px;border-radius:10px}.error{color:#a94736;background:#fff0eb}.success{color:#286347;background:#ebf7ef}.empty{padding:28px;text-align:center;color:#829087}button:disabled{opacity:.55;cursor:wait}@media(max-width:700px){header{align-items:flex-start}.grid,.uploads{grid-template-columns:1fr}.cards article{grid-template-columns:52px 1fr}.cards article>img{width:52px;height:52px}.actions,.stock{grid-column:1/-1;flex-wrap:wrap}.panel{padding:18px}}
</style>
