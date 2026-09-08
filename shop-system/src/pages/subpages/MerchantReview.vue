<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { MerchantApplication, RejectionReasonOption } from '../../../../shared/api'
import { getMerchantApplications, getReviewReasons, reviewMerchantApplication } from '../../api'
import { toAssetURL } from '../../config'

const list = ref<MerchantApplication[]>([]), reasons = ref<RejectionReasonOption[]>([]), loading = ref(false)
const status = ref('pending'), rejectVisible = ref(false), selected = ref<MerchantApplication | null>(null)
const reasonIds = ref<Array<string | number>>([]), note = ref(''), submitting = ref(false)
const statusText: Record<string, string> = { pending: '待审核', approved: '已通过', rejected: '已拒绝', suspended: '已停用' }
async function load() { loading.value = true; try { list.value = await getMerchantApplications(status.value || undefined) } finally { loading.value = false } }
async function approve(item: MerchantApplication) {
  try {
    await ElMessageBox.confirm(`确认批准“${item.shop_name}”的商家申请吗？`, '批准申请', { type: 'success' })
    await reviewMerchantApplication({ id: item.id, decision: 'approved', reason_ids: [], additional_note: '' })
    ElMessage.success('商家申请已批准，站内消息已发送'); await load()
  } catch (error) { if (error !== 'cancel' && error !== 'close') return }
}
function openReject(item: MerchantApplication) { selected.value = item; reasonIds.value = []; note.value = ''; rejectVisible.value = true }
async function reject() {
  if (!selected.value || (!reasonIds.value.length && !note.value.trim())) { ElMessage.warning('请选择常见原因或填写补充说明'); return }
  const other = reasons.value.find(item => item.label === '其他原因')
  if (other && reasonIds.value.includes(other.id) && !note.value.trim()) { ElMessage.warning('选择其他原因时必须填写补充说明'); return }
  submitting.value = true
  try {
    await reviewMerchantApplication({ id: selected.value.id, decision: 'rejected', reason_ids: reasonIds.value.map(Number), additional_note: note.value.trim() })
    rejectVisible.value = false; ElMessage.success('已拒绝并发送站内消息'); await load()
  } finally { submitting.value = false }
}
onMounted(async () => { reasons.value = await getReviewReasons('merchant_application'); await load() })
</script>
<template>
  <div><div class="heading"><div><h2>商家入驻审核</h2><p>审核用户提交的店铺和资质信息</p></div><el-select v-model="status" style="width:150px" @change="load"><el-option label="全部状态" value=""/><el-option label="待审核" value="pending"/><el-option label="已通过" value="approved"/><el-option label="已拒绝" value="rejected"/></el-select></div>
    <el-table v-loading="loading" :data="list" border stripe row-key="id">
      <el-table-column type="expand"><template #default="scope"><div class="detail"><p><b>联系人：</b>{{ scope.row.contact_name }} · {{ scope.row.contact_phone }}</p><p><b>店铺简介：</b>{{ scope.row.description || '未填写' }}</p><p v-if="scope.row.rejection_reason"><b>审核意见：</b>{{ scope.row.rejection_reason }}</p><a :href="toAssetURL(scope.row.qualification_picture)" target="_blank"><img :src="toAssetURL(scope.row.qualification_picture)" alt="资质图片"></a></div></template></el-table-column>
      <el-table-column prop="shop_name" label="店铺名称" min-width="180"/><el-table-column prop="username" label="申请用户" width="140"/><el-table-column prop="contact_name" label="联系人" width="120"/><el-table-column label="提交时间" min-width="170"><template #default="scope">{{ new Date(scope.row.submitted_at).toLocaleString() }}</template></el-table-column><el-table-column label="状态" width="100"><template #default="scope"><el-tag :type="scope.row.status === 'approved' ? 'success' : scope.row.status === 'rejected' ? 'danger' : 'warning'">{{ statusText[scope.row.status] }}</el-tag></template></el-table-column>
      <el-table-column label="操作" width="170" fixed="right"><template #default="scope"><template v-if="scope.row.status === 'pending'"><el-button link type="success" @click="approve(scope.row)">批准</el-button><el-button link type="danger" @click="openReject(scope.row)">拒绝</el-button></template><span v-else>{{ scope.row.reviewer_name || '—' }}</span></template></el-table-column>
    </el-table>
    <el-dialog v-model="rejectVisible" title="拒绝商家申请" width="min(560px, 92vw)"><p>请选择一个或多个常见原因：</p><el-checkbox-group v-model="reasonIds" class="reason-list"><el-checkbox v-for="item in reasons" :key="item.id" :label="item.id">{{ item.label }}</el-checkbox></el-checkbox-group><textarea v-model="note" rows="4" maxlength="500" placeholder="补充说明（选择“其他原因”时必填）"/><template #footer><el-button @click="rejectVisible=false">取消</el-button><el-button type="danger" :loading="submitting" @click="reject">确认拒绝</el-button></template></el-dialog>
  </div>
</template>
<style scoped>
.heading{display:flex;align-items:end;justify-content:space-between;margin-bottom:20px}.heading h2{margin:0}.heading p{margin:7px 0 0;color:#909399}.detail{padding:8px 45px;line-height:1.7}.detail img{width:220px;max-height:160px;object-fit:contain;background:#f5f7fa;border-radius:6px}.reason-list{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:16px 0 22px}textarea{box-sizing:border-box;width:100%;padding:12px;border:1px solid #dcdfe6;border-radius:4px;font:inherit;resize:vertical}
</style>
