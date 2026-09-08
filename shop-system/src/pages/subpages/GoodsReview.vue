<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { GoodsSubmission, RejectionReasonOption } from '../../../../shared/api'
import { getGoodsSubmissions, getReviewReasons, reviewGoodsSubmission } from '../../api'
import { toAssetURL } from '../../config'

const list = ref<GoodsSubmission[]>([]), reasons = ref<RejectionReasonOption[]>([]), loading = ref(false)
const status = ref('pending'), rejectVisible = ref(false), selected = ref<GoodsSubmission | null>(null)
const reasonIds = ref<Array<string | number>>([]), note = ref(''), submitting = ref(false)
const statusText: Record<string, string> = { draft: '草稿', pending: '待审核', approved: '已通过', rejected: '已拒绝' }
async function load() { loading.value = true; try { list.value = await getGoodsSubmissions(status.value || undefined) } finally { loading.value = false } }
async function approve(item: GoodsSubmission) {
  try {
    await ElMessageBox.confirm(`确认批准商品“${item.name}”吗？通过后商家可以上架。`, '批准商品', { type: 'success' })
    await reviewGoodsSubmission({ id: item.id, decision: 'approved', reason_ids: [], additional_note: '' })
    ElMessage.success('商品已批准，站内消息已发送'); await load()
  } catch (error) { if (error !== 'cancel' && error !== 'close') return }
}
function openReject(item: GoodsSubmission) { selected.value = item; reasonIds.value = []; note.value = ''; rejectVisible.value = true }
async function reject() {
  if (!selected.value || (!reasonIds.value.length && !note.value.trim())) { ElMessage.warning('请选择常见原因或填写补充说明'); return }
  const other = reasons.value.find(item => item.label === '其他原因')
  if (other && reasonIds.value.includes(other.id) && !note.value.trim()) { ElMessage.warning('选择其他原因时必须填写补充说明'); return }
  submitting.value = true
  try {
    await reviewGoodsSubmission({ id: selected.value.id, decision: 'rejected', reason_ids: reasonIds.value.map(Number), additional_note: note.value.trim() })
    rejectVisible.value = false; ElMessage.success('已拒绝并发送站内消息'); await load()
  } finally { submitting.value = false }
}
onMounted(async () => { reasons.value = await getReviewReasons('goods_submission'); await load() })
</script>
<template>
  <div><div class="heading"><div><h2>商品审核</h2><p>审核商家提交的商品内容；库存仅供查看，审核人员不能修改</p></div><el-select v-model="status" style="width:150px" @change="load"><el-option label="全部状态" value=""/><el-option label="待审核" value="pending"/><el-option label="已通过" value="approved"/><el-option label="已拒绝" value="rejected"/></el-select></div>
    <el-table v-loading="loading" :data="list" border stripe row-key="id">
      <el-table-column type="expand"><template #default="scope"><div class="detail"><p><b>商家：</b>{{ scope.row.merchant_name }}　<b>提交类型：</b>{{ scope.row.action === 'create' ? '新商品' : '修改商品' }}</p><p><b>规格：</b>{{ scope.row.spec || '默认规格' }}</p><p><b>介绍：</b>{{ scope.row.description || '未填写' }}</p><p v-if="scope.row.rejection_reason"><b>审核意见：</b>{{ scope.row.rejection_reason }}</p><div class="album"><img :src="toAssetURL(scope.row.picture)" alt="主图"><img v-for="picture in scope.row.album" :key="picture" :src="toAssetURL(picture)" alt="相册图"></div></div></template></el-table-column>
      <el-table-column label="商品" min-width="240"><template #default="scope"><div class="goods"><img :src="toAssetURL(scope.row.picture)" alt=""><div><strong>{{ scope.row.name }}</strong><small>{{ scope.row.merchant_name }}</small></div></div></template></el-table-column><el-table-column label="价格" width="110"><template #default="scope">¥{{ scope.row.price.toFixed(2) }}</template></el-table-column><el-table-column prop="stock" label="库存（只读）" width="120"/><el-table-column label="状态" width="100"><template #default="scope"><el-tag :type="scope.row.status === 'approved' ? 'success' : scope.row.status === 'rejected' ? 'danger' : 'warning'">{{ statusText[scope.row.status] }}</el-tag></template></el-table-column><el-table-column label="提交时间" min-width="170"><template #default="scope">{{ scope.row.submitted_at ? new Date(scope.row.submitted_at).toLocaleString() : '未提交' }}</template></el-table-column>
      <el-table-column label="操作" width="170" fixed="right"><template #default="scope"><template v-if="scope.row.status === 'pending'"><el-button link type="success" @click="approve(scope.row)">批准</el-button><el-button link type="danger" @click="openReject(scope.row)">拒绝</el-button></template><span v-else>{{ scope.row.reviewer_name || '—' }}</span></template></el-table-column>
    </el-table>
    <el-dialog v-model="rejectVisible" title="拒绝商品" width="min(580px, 92vw)"><p>请选择一个或多个常见原因：</p><el-checkbox-group v-model="reasonIds" class="reason-list"><el-checkbox v-for="item in reasons" :key="item.id" :label="item.id">{{ item.label }}</el-checkbox></el-checkbox-group><textarea v-model="note" rows="4" maxlength="500" placeholder="补充说明（选择“其他原因”时必填）"/><template #footer><el-button @click="rejectVisible=false">取消</el-button><el-button type="danger" :loading="submitting" @click="reject">确认拒绝</el-button></template></el-dialog>
  </div>
</template>
<style scoped>
.heading{display:flex;align-items:end;justify-content:space-between;margin-bottom:20px}.heading h2{margin:0}.heading p{margin:7px 0 0;color:#909399}.goods{display:flex;align-items:center;gap:12px}.goods img{width:52px;height:52px;border-radius:5px;object-fit:cover}.goods small{display:block;margin-top:7px;color:#909399}.detail{padding:8px 45px;line-height:1.7}.album{display:flex;gap:10px;flex-wrap:wrap}.album img{width:100px;height:100px;border-radius:6px;object-fit:cover;background:#f5f7fa}.reason-list{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:16px 0 22px}textarea{box-sizing:border-box;width:100%;padding:12px;border:1px solid #dcdfe6;border-radius:4px;font:inherit;resize:vertical}
</style>
