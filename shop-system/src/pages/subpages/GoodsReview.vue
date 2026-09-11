<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { GoodsSubmission, RejectionReasonOption } from '../../../../shared/api'
import { getGoodsSubmissions, getReviewReasons, reviewGoodsSubmission } from '../../api'
import { toAssetURL } from '../../config'

const list = ref<GoodsSubmission[]>([])
const reasons = ref<RejectionReasonOption[]>([])
const loading = ref(false), submitting = ref(false)
const status = ref('pending'), detailVisible = ref(false), rejectVisible = ref(false)
const detailItem = ref<GoodsSubmission | null>(null), rejectItem = ref<GoodsSubmission | null>(null)
const reasonIds = ref<Array<string | number>>([]), note = ref('')
const statusText: Record<string, string> = { draft: '草稿', pending: '待审核', approved: '已通过', rejected: '已拒绝' }

async function load() {
  loading.value = true
  try {
    list.value = await getGoodsSubmissions(status.value || undefined)
    if (detailItem.value) {
      detailItem.value = list.value.find(item => item.id === detailItem.value?.id) ?? null
      if (!detailItem.value) detailVisible.value = false
    }
  } finally { loading.value = false }
}
function openDetail(item: GoodsSubmission) { detailItem.value = item; detailVisible.value = true }
async function approve(item: GoodsSubmission) {
  try {
    await ElMessageBox.confirm('确认批准商品“' + item.name + '”吗？通过后商家可以上架。', '批准商品', { type: 'success' })
    await reviewGoodsSubmission({ id: item.id, decision: 'approved', reason_ids: [], additional_note: '' })
    detailVisible.value = false
    ElMessage.success('商品已批准，站内消息已发送')
    await load()
  } catch (error) { if (error !== 'cancel' && error !== 'close') throw error }
}
function openReject(item: GoodsSubmission) {
  rejectItem.value = item; reasonIds.value = []; note.value = ''; rejectVisible.value = true
}
async function reject() {
  if (!rejectItem.value || (!reasonIds.value.length && !note.value.trim())) {
    ElMessage.warning('请选择常见原因或填写补充说明'); return
  }
  const other = reasons.value.find(item => item.label === '其他原因')
  if (other && reasonIds.value.includes(other.id) && !note.value.trim()) {
    ElMessage.warning('选择其他原因时必须填写补充说明'); return
  }
  submitting.value = true
  try {
    await reviewGoodsSubmission({
      id: rejectItem.value.id,
      decision: 'rejected',
      reason_ids: reasonIds.value.map(Number),
      additional_note: note.value.trim()
    })
    rejectVisible.value = false; detailVisible.value = false
    ElMessage.success('已拒绝并发送站内消息')
    await load()
  } finally { submitting.value = false }
}
onMounted(async () => { reasons.value = await getReviewReasons('goods_submission'); await load() })
</script>

<template>
  <div>
    <div class="heading"><div><h2>商品审核</h2><p>列表只展示关键信息，商品参数和图片在右侧详情中查看。</p></div><el-select v-model="status" style="width:150px" @change="load"><el-option label="全部状态" value=""/><el-option label="待审核" value="pending"/><el-option label="已通过" value="approved"/><el-option label="已拒绝" value="rejected"/></el-select></div>
    <el-table v-loading="loading" :data="list" border stripe row-key="id">
      <el-table-column label="商品" min-width="250"><template #default="scope"><div class="goods"><img :src="toAssetURL(scope.row.picture)" alt=""><div><strong>{{ scope.row.name }}</strong><small>{{ scope.row.merchant_name }}</small></div></div></template></el-table-column>
      <el-table-column label="提交类型" width="100"><template #default="scope">{{ scope.row.action === 'create' ? '新商品' : '修改商品' }}</template></el-table-column>
      <el-table-column label="价格" width="110"><template #default="scope">¥{{ scope.row.price.toFixed(2) }}</template></el-table-column>
      <el-table-column prop="stock" label="库存（只读）" width="120"/>
      <el-table-column label="状态" width="100"><template #default="scope"><el-tag :type="scope.row.status === 'approved' ? 'success' : scope.row.status === 'rejected' ? 'danger' : 'warning'">{{ statusText[scope.row.status] }}</el-tag></template></el-table-column>
      <el-table-column label="提交时间" min-width="175"><template #default="scope">{{ scope.row.submitted_at ? new Date(scope.row.submitted_at).toLocaleString() : '未提交' }}</template></el-table-column>
      <el-table-column label="操作" width="120" fixed="right"><template #default="scope"><el-button link type="primary" @click="openDetail(scope.row)">{{ scope.row.status === 'pending' ? '查看审核' : '查看详情' }}</el-button></template></el-table-column>
    </el-table>

    <el-drawer v-model="detailVisible" title="商品审核详情" size="min(640px, 94vw)" destroy-on-close>
      <div v-if="detailItem" class="drawer-body">
        <section class="summary"><img :src="toAssetURL(detailItem.picture)" alt="商品主图"><div><h3>{{ detailItem.name }}</h3><p>{{ detailItem.merchant_name }}</p><el-tag :type="detailItem.status === 'approved' ? 'success' : detailItem.status === 'rejected' ? 'danger' : 'warning'">{{ statusText[detailItem.status] }}</el-tag></div></section>
        <section class="info-section"><h4>基础参数</h4><dl><div><dt>提交类型</dt><dd>{{ detailItem.action === 'create' ? '发布新商品' : '修改已有商品' }}</dd></div><div><dt>商品分类ID</dt><dd>{{ detailItem.category_id }}</dd></div><div><dt>销售价格</dt><dd>¥{{ detailItem.price.toFixed(2) }}</dd></div><div><dt>库存</dt><dd>{{ detailItem.stock }}（只读）</dd></div><div><dt>商品规格</dt><dd>{{ detailItem.spec || '默认规格' }}</dd></div><div><dt>提交时间</dt><dd>{{ detailItem.submitted_at ? new Date(detailItem.submitted_at).toLocaleString() : '未提交' }}</dd></div></dl></section>
        <section class="info-section"><h4>商品介绍</h4><p class="description">{{ detailItem.description || '未填写商品介绍' }}</p></section>
        <section class="info-section"><h4>商品图片</h4><div class="album"><figure><img :src="toAssetURL(detailItem.picture)" alt="主图"><figcaption>主图</figcaption></figure><figure v-for="(picture,index) in detailItem.album" :key="picture"><img :src="toAssetURL(picture)" alt="相册图"><figcaption>相册 {{ index + 1 }}</figcaption></figure></div></section>
        <section v-if="detailItem.rejection_reason" class="review-note"><h4>审核意见</h4><p>{{ detailItem.rejection_reason }}</p><small v-if="detailItem.reviewer_name">{{ detailItem.reviewer_name }} · {{ detailItem.reviewed_at ? new Date(detailItem.reviewed_at).toLocaleString() : '' }}</small></section>
      </div>
      <template v-if="detailItem?.status === 'pending'" #footer><div class="drawer-actions"><el-button @click="detailVisible=false">关闭</el-button><el-button type="danger" @click="openReject(detailItem)">拒绝</el-button><el-button type="success" @click="approve(detailItem)">批准</el-button></div></template>
    </el-drawer>

    <el-dialog v-model="rejectVisible" title="拒绝商品" width="min(580px, 92vw)"><p>请选择一个或多个常见原因：</p><el-checkbox-group v-model="reasonIds" class="reason-list"><el-checkbox v-for="item in reasons" :key="item.id" :label="item.id">{{ item.label }}</el-checkbox></el-checkbox-group><textarea v-model="note" rows="4" maxlength="500" placeholder="补充说明（选择“其他原因”时必填）"/><template #footer><el-button @click="rejectVisible=false">取消</el-button><el-button type="danger" :loading="submitting" @click="reject">确认拒绝</el-button></template></el-dialog>
  </div>
</template>

<style scoped>
.heading{display:flex;align-items:end;justify-content:space-between;margin-bottom:20px}.heading h2{margin:0}.heading p{margin:7px 0 0;color:#909399}.goods{display:flex;align-items:center;gap:12px}.goods img{width:52px;height:52px;border-radius:6px;object-fit:cover}.goods small{display:block;margin-top:7px;color:#909399}.drawer-body{padding:0 4px 24px}.summary{display:flex;padding:16px;align-items:center;gap:16px;border-radius:10px;background:#f5f7fa}.summary>img{width:92px;height:92px;border-radius:8px;object-fit:cover}.summary h3{margin:0 0 8px;font-size:20px}.summary p{margin:0 0 10px;color:#909399}.info-section{padding:22px 2px;border-bottom:1px solid #ebeef5}.info-section h4,.review-note h4{margin:0 0 14px}.info-section dl{display:grid;margin:0;grid-template-columns:1fr 1fr;gap:12px}.info-section dl div{padding:11px 13px;border-radius:7px;background:#f8fafc}.info-section dt{margin-bottom:5px;color:#909399;font-size:12px}.info-section dd{margin:0;color:#303133}.description{margin:0;white-space:pre-wrap;line-height:1.8}.album{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.album figure{margin:0;overflow:hidden;border:1px solid #ebeef5;border-radius:7px}.album img{display:block;width:100%;aspect-ratio:1;object-fit:cover}.album figcaption{padding:6px;text-align:center;color:#909399;font-size:11px}.review-note{margin-top:20px;padding:15px;border-radius:8px;color:#a54837;background:#fff4f1}.review-note p{line-height:1.7}.review-note small{color:#909399}.drawer-actions{display:flex;width:100%;justify-content:flex-end}.reason-list{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:16px 0 22px}textarea{box-sizing:border-box;width:100%;padding:12px;border:1px solid #dcdfe6;border-radius:4px;font:inherit;resize:vertical}@media(max-width:600px){.heading{align-items:stretch;flex-direction:column;gap:14px}.info-section dl{grid-template-columns:1fr}.album{grid-template-columns:repeat(3,1fr)}.reason-list{grid-template-columns:1fr}}
</style>
