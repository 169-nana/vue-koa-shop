<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { EnforcementAction, EnforcementGoods, EnforcementRecord, MerchantApplication, RejectionReasonOption, ReviewRecord, GovernanceTab, GovernanceQuery, GovernancePreview, GovernanceRecordDetail } from '../../../../shared/api'
import { enforceBusiness, getEnforcementReasons, getEnforcementRecords, getGovernanceGoods, getGovernanceMerchants, getReviewRecords, getGovernancePreview, getGovernanceDetail } from '../../api'
import useAdmin from '../../stores/admin'
import { toAssetURL } from '../../config'

type SelectedTarget = { type: 'goods'; item: EnforcementGoods } | { type: 'merchant'; item: MerchantApplication }
const active = ref<GovernanceTab>('goods')
const states = reactive<Record<GovernanceTab, { loading: boolean; loaded: boolean; error: string; total: number; query: GovernanceQuery; sequence: number }>>({
  goods: state(), merchants: state(), reviews: state(), records: state()
})
function state() { return { loading: false, loaded: false, error: '', total: 0, sequence: 0, query: { page: 1, page_size: 20 } } }
const current = computed(() => states[active.value])
const loading = computed(() => current.value.loading)
const isAdmin = computed(() => useAdmin().admin.role === 'admin')
const submitting = ref(false), dialogVisible = ref(false), previewLoading = ref(false)
const goods = ref<EnforcementGoods[]>([]), merchants = ref<MerchantApplication[]>([])
const reviewRecords = ref<ReviewRecord[]>([]), enforcementRecords = ref<EnforcementRecord[]>([])
const goodsReasons = ref<RejectionReasonOption[]>([]), merchantReasons = ref<RejectionReasonOption[]>([])
const selected = ref<SelectedTarget | null>(null), action = ref<EnforcementAction>('force_off_sale')
const reasonIds = ref<Array<string | number>>([]), note = ref(''), confirmation = ref(''), dialogError = ref('')
const preview = ref<GovernancePreview | null>(null)
const currentReasons = computed(() => selected.value?.type === 'goods' ? goodsReasons.value : merchantReasons.value)
const actionText: Record<EnforcementAction, string> = { force_off_sale: '强制下架商品', suspend: '暂停店铺', revoke: '撤销资质', restore: '恢复经营' }
const dialogTitle = computed(() => actionText[action.value])
const labels: Record<string, string> = { ...actionText, pending: '待审核', approved: '正常经营', rejected: '拒绝', suspended: '暂停经营', revoked: '资质已撤销', on_sale: '在售', off_sale: '已下架', normal: '合规正常', forced_off_sale: '平台强制下架', terminated: '因资质撤销终止审核', manual: '人工审核', enforcement: '关联处置', admin: '管理员', reviewer: '审核人员', create: '新建', update: '修改' }
function statusText(value: unknown): string { return typeof value === 'string' ? value.split('/').map(item => labels[item] ?? item).join(' · ') : '—' }
const merchantStatusText = statusText
function recordAction(record: EnforcementRecord) {
  if (record.business_type === 'goods' && record.parent_record_id) return record.action === 'suspend' ? '店铺暂停关联下架' : '资质撤销关联下架'
  return statusText(record.action)
}
const statusOptions = computed(() => active.value === 'goods' ? ['normal', 'forced_off_sale'] : active.value === 'merchants' ? ['pending', 'approved', 'rejected', 'suspended', 'revoked'] : active.value === 'reviews' ? ['approved', 'rejected', 'terminated'] : ['force_off_sale', 'suspend', 'revoke', 'restore'])
function message(error: unknown) { return error instanceof Error ? error.message : '加载失败，请重试' }
async function load(tab: GovernanceTab = active.value) {
  const target = states[tab], sequence = ++target.sequence
  target.loading = true; target.error = ''
  const query = { ...target.query }
  try {
    if (tab === 'goods') { const result = await getGovernanceGoods(query); if (sequence !== target.sequence) return; goods.value = result.list; target.total = result.total }
    else if (tab === 'merchants') { const result = await getGovernanceMerchants(query); if (sequence !== target.sequence) return; merchants.value = result.list; target.total = result.total }
    else if (tab === 'reviews') { const result = await getReviewRecords(query); if (sequence !== target.sequence) return; reviewRecords.value = result.list; target.total = result.total }
    else { const result = await getEnforcementRecords(query); if (sequence !== target.sequence) return; enforcementRecords.value = result.list; target.total = result.total }
    target.loaded = true
  } catch (error: unknown) { if (sequence === target.sequence) target.error = message(error) }
  finally { if (sequence === target.sequence) target.loading = false }
}
function changeTab(value: string | number) { if (value === 'goods' || value === 'merchants' || value === 'reviews' || value === 'records') active.value = value }
function search() { current.value.query.page = 1; void load() }
function reset() { current.value.query = { page: 1, page_size: 20 }; void load() }
watch(active, tab => { if (!states[tab].loaded) void load(tab) })
let previewSequence = 0
async function open(target: SelectedTarget, nextAction: EnforcementAction) {
  const sequence = ++previewSequence
  selected.value = target; action.value = nextAction; preview.value = null
  reasonIds.value = []; note.value = ''; confirmation.value = ''; dialogError.value = ''; dialogVisible.value = true; previewLoading.value = true
  try {
    const [data, reasons] = await Promise.all([getGovernancePreview(target.type, target.item.id), getEnforcementReasons(target.type === 'goods' ? 'goods_enforcement' : 'merchant_enforcement')])
    if (sequence !== previewSequence) return
    preview.value = data
    if (target.type === 'goods') goodsReasons.value = reasons; else merchantReasons.value = reasons
  } catch (error: unknown) { if (sequence === previewSequence) dialogError.value = message(error) }
  finally { if (sequence === previewSequence) previewLoading.value = false }
}
function openGoods(item: EnforcementGoods) { void open({ type: 'goods', item }, 'force_off_sale') }
function openMerchant(item: MerchantApplication, nextAction: 'suspend' | 'revoke' | 'restore') { void open({ type: 'merchant', item }, nextAction) }
async function submit() {
  if (submitting.value || !selected.value || !preview.value) return
  if (action.value === 'restore' && !note.value.trim()) { ElMessage.warning('请填写整改核验结果及恢复经营依据'); return }
  if (action.value !== 'restore' && !reasonIds.value.length && !note.value.trim()) { ElMessage.warning('请选择违规原因或填写补充说明'); return }
  const other = currentReasons.value.find(item => item.label === '其他原因')
  if (other && reasonIds.value.includes(other.id) && !note.value.trim()) { ElMessage.warning('选择其他原因时必须填写补充说明'); return }
  if (action.value === 'revoke' && confirmation.value !== preview.value.name) { ElMessage.warning('请输入完整店铺名称确认撤销'); return }
  submitting.value = true; dialogError.value = ''
  try {
    await enforceBusiness({ business_type: selected.value.type, business_id: selected.value.item.id, action: action.value,
      reason_ids: reasonIds.value.map(Number), additional_note: note.value.trim(), expected_version: preview.value.version, confirmation_name: confirmation.value })
    dialogVisible.value = false
    ElMessage.success('处置完成，已记录操作并通知商家')
    states.records.loaded = false
    if (selected.value.type === 'merchant') { states.goods.loaded = false; states.reviews.loaded = false }
    await load()
  } catch (error: unknown) { dialogError.value = message(error) }
  finally { submitting.value = false }
}
function reasonsText(values: string[], noteText: string) { return [...values, noteText].filter(Boolean).join('；') || '—' }
const drawer = ref(false), detailLoading = ref(false), detailError = ref(''), recordDetail = ref<GovernanceRecordDetail | null>(null)
const detailKind = ref<'reviews' | 'records'>('records'), detailId = ref(0)
let detailSequence = 0
async function showDetail(kind: 'reviews' | 'records', id: number) {
  const sequence = ++detailSequence
  drawer.value = true; detailLoading.value = true; detailError.value = ''; recordDetail.value = null; detailKind.value = kind; detailId.value = id
  try { const result = await getGovernanceDetail(kind, id); if (sequence === detailSequence) recordDetail.value = result }
  catch (error: unknown) { if (sequence === detailSequence) detailError.value = message(error) }
  finally { if (sequence === detailSequence) detailLoading.value = false }
}
const fieldLabels: Record<string, string> = { business_id: '对象编号', business_name: '对象名称', business_type: '对象类型', id: '对象编号', name: '商品名称', shop_name: '店铺名称', merchant_name: '所属店铺', merchant_id: '店铺编号', goods_id: '商品编号', category_id: '分类编号', price: '价格', stock: '库存', spec: '规格', description: '描述', contact_name: '联系人', contact_phone: '联系电话', status: '状态', sale_status: '销售状态', compliance_status: '合规状态', compliance_reason: '处置原因', picture: '商品图片', qualification_picture: '资质图片', action: '操作', decision: '审核结果', previous_status: '处置前状态', next_status: '处置后状态', additional_note: '说明', operator_name_snapshot: '操作人', operator_role_snapshot: '操作人角色', reviewer_name_snapshot: '审核人', reviewer_role_snapshot: '审核人角色', created_at: '记录时间', reason_snapshot: '原因' }
function fields(value: Record<string, unknown> | null) { return Object.entries(value ?? {}).filter(([key]) => key in fieldLabels && key !== 'picture' && key !== 'qualification_picture') }
function display(key: string, value: unknown): string {
  if (value === null || value === '') return '—'
  if (Array.isArray(value)) return value.map(item => String(item)).join('；')
  if (key === 'decision' && value === 'approved') return '批准'
  if (key === 'business_type') return value === 'goods' ? '商品' : value === 'goods_submission' ? '商品审核申请' : '店铺'
  if (key.includes('status') || key.includes('role') || key === 'action' || key === 'decision') return statusText(value)
  if (key === 'created_at' && typeof value === 'string') return new Date(value).toLocaleString()
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}
function picture(value: Record<string, unknown> | null, key: string): string { const path = value?.[key]; return typeof path === 'string' ? toAssetURL(path) : '' }
onMounted(() => { void load() })
</script>

<template>
  <div class="page"><div class="heading"><div><h2>违规处置与审核记录</h2><p>审核人员可下架商品、暂停店铺；恢复经营与撤销资质仅限管理员。</p></div><el-button :loading="loading" @click="load()">刷新</el-button></div>
    <div class="filters" @keyup.enter="search"><el-form inline>
      <el-form-item label="对象"><el-input v-model="current.query.keyword" placeholder="名称或对象 ID" clearable /></el-form-item>
      <el-form-item label="店铺"><el-input v-model="current.query.merchant" placeholder="店铺名称" clearable /></el-form-item>
      <el-form-item label="状态 / 动作"><el-select v-model="current.query.status" clearable style="width:170px"><el-option v-for="value in statusOptions" :key="value" :value="value" :label="active === 'reviews' && value === 'approved' ? '批准' : statusText(value)" /></el-select></el-form-item>
      <el-form-item label="操作人"><el-input v-model="current.query.operator" clearable /></el-form-item>
      <el-form-item :label="active === 'goods' || active === 'merchants' ? '最近处置日期' : '记录日期'"><el-date-picker v-model="current.query.start_date" value-format="YYYY-MM-DD" placeholder="开始日期" style="width:145px" /> 至 <el-date-picker v-model="current.query.end_date" value-format="YYYY-MM-DD" placeholder="结束日期" style="width:145px" /></el-form-item>
      <el-form-item><el-button type="primary" @click="search">查询</el-button><el-button @click="reset">重置</el-button></el-form-item>
    </el-form></div>
    <el-alert v-if="current.error" :title="current.error" type="error" :closable="false"><el-button link @click="load()">重新加载当前列表</el-button></el-alert>
    <el-tabs :model-value="active" @update:model-value="changeTab">
      <el-tab-pane label="商品处置" name="goods"><el-table v-loading="loading" :data="goods" border stripe row-key="id"><el-table-column label="商品" min-width="230"><template #default="scope"><div class="goods"><img :src="toAssetURL(scope.row.picture)" alt=""><div><strong>{{ scope.row.name }}</strong><small>{{ scope.row.merchant_name }}</small></div></div></template></el-table-column><el-table-column label="销售状态" width="110"><template #default="scope"><el-tag :type="scope.row.sale_status === 'on_sale' ? 'success' : 'info'">{{ scope.row.sale_status === 'on_sale' ? '在售' : '已下架' }}</el-tag></template></el-table-column><el-table-column label="合规状态" width="125"><template #default="scope"><el-tag :type="scope.row.compliance_status === 'normal' ? 'success' : 'danger'">{{ scope.row.compliance_status === 'normal' ? '正常' : '平台下架' }}</el-tag></template></el-table-column><el-table-column prop="compliance_reason" label="最近处置原因" min-width="220" show-overflow-tooltip/><el-table-column label="操作" width="120" fixed="right"><template #default="scope"><el-button link type="danger" :disabled="scope.row.compliance_status === 'forced_off_sale'" @click="openGoods(scope.row)">强制下架</el-button></template></el-table-column></el-table></el-tab-pane>
      <el-tab-pane label="店铺处置" name="merchants"><el-table v-loading="loading" :data="merchants" border stripe row-key="id"><el-table-column prop="shop_name" label="店铺" min-width="180"/><el-table-column prop="username" label="商家账号" width="140"/><el-table-column label="状态" width="120"><template #default="scope"><el-tag :type="scope.row.status === 'approved' ? 'success' : scope.row.status === 'revoked' ? 'danger' : 'warning'">{{ merchantStatusText(scope.row.status) }}</el-tag></template></el-table-column><el-table-column prop="enforcement_reason" label="最近处置原因" min-width="220" show-overflow-tooltip/><el-table-column label="操作" width="230" fixed="right"><template #default="scope"><template v-if="scope.row.status === 'approved'"><el-button link type="warning" @click="openMerchant(scope.row,'suspend')">暂停经营</el-button><el-button v-if="isAdmin" link type="danger" @click="openMerchant(scope.row,'revoke')">撤销资质</el-button></template><template v-else-if="scope.row.status === 'suspended'"><el-button v-if="isAdmin" link type="success" @click="openMerchant(scope.row,'restore')">恢复经营</el-button><el-button v-if="isAdmin" link type="danger" @click="openMerchant(scope.row,'revoke')">撤销资质</el-button></template><span v-else>当前状态不可处置</span></template></el-table-column></el-table></el-tab-pane>
      <el-tab-pane label="审核记录" name="reviews"><el-table v-loading="loading" :data="reviewRecords" border stripe row-key="id"><el-table-column prop="business_name" label="审核对象" min-width="190"/><el-table-column prop="merchant_name" label="所属店铺" min-width="150"/><el-table-column label="类型" width="110"><template #default="scope">{{ scope.row.business_type === 'goods_submission' ? '商品审核' : '店铺审核' }}</template></el-table-column><el-table-column label="结果" width="90"><template #default="scope"><el-tag :type="scope.row.decision === 'approved' ? 'success' : 'danger'">{{ scope.row.record_source === 'enforcement' ? '关联终止' : scope.row.decision === 'approved' ? '批准' : '拒绝' }}</el-tag></template></el-table-column><el-table-column label="原因/备注" min-width="220"><template #default="scope">{{ reasonsText(scope.row.reason_snapshot,scope.row.additional_note) }}</template></el-table-column><el-table-column label="审核人员" width="150"><template #default="scope">{{ scope.row.reviewer_name }}<small class="role">{{ scope.row.reviewer_role === 'admin' ? '管理员' : '审核人员' }}</small></template></el-table-column><el-table-column label="审核时间" width="180"><template #default="scope">{{ new Date(scope.row.created_at).toLocaleString() }}</template></el-table-column><el-table-column label="详情" width="85" fixed="right"><template #default="scope"><el-button link type="primary" @click="showDetail('reviews', scope.row.id)">查看</el-button></template></el-table-column></el-table></el-tab-pane>
      <el-tab-pane label="处置记录" name="records"><el-table v-loading="loading" :data="enforcementRecords" border stripe row-key="id"><el-table-column prop="business_name" label="处置对象" min-width="190"/><el-table-column prop="merchant_name" label="店铺" min-width="150"/><el-table-column label="动作" width="130"><template #default="scope"><el-tag type="warning">{{ recordAction(scope.row) }}</el-tag></template></el-table-column><el-table-column label="状态变化" min-width="180"><template #default="scope">{{ statusText(scope.row.previous_status) }} → {{ statusText(scope.row.next_status) }}</template></el-table-column><el-table-column label="原因/备注" min-width="240"><template #default="scope">{{ reasonsText(scope.row.reason_snapshot,scope.row.additional_note) }}</template></el-table-column><el-table-column label="操作人员" width="150"><template #default="scope">{{ scope.row.operator_name }}<small class="role">{{ scope.row.operator_role === 'admin' ? '管理员' : '审核人员' }}</small></template></el-table-column><el-table-column label="操作时间" width="180"><template #default="scope">{{ new Date(scope.row.created_at).toLocaleString() }}</template></el-table-column><el-table-column label="详情" width="85" fixed="right"><template #default="scope"><el-button link type="primary" @click="showDetail('records', scope.row.id)">查看</el-button></template></el-table-column></el-table></el-tab-pane>
    </el-tabs>
    <el-pagination class="pagination" v-model:current-page="current.query.page" v-model:page-size="current.query.page_size" :total="current.total" :page-sizes="[20,50,100]" layout="total, sizes, prev, pager, next" @current-change="load()" @size-change="search" />
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="min(620px,92vw)" :close-on-click-modal="!submitting" :close-on-press-escape="!submitting" :show-close="!submitting">
      <div v-loading="previewLoading">
        <el-alert v-if="dialogError" :title="dialogError" type="error" :closable="false" />
        <p v-if="preview"><strong>{{ preview.name }}</strong> · ID {{ selected?.item.id }}<br>当前状态：{{ statusText(preview.status) }}</p>
        <p v-if="preview && selected?.type === 'merchant'" class="impact">当前店铺有 {{ preview.goods_count }} 件商品、{{ preview.pending_count }} 条待审核申请。数量以提交时为准。</p>
        <el-alert v-if="action === 'suspend'" title="暂停后全部商品下架，店铺暂时无法经营；待审核申请保留。" type="warning" :closable="false" />
        <el-alert v-if="action === 'revoke'" title="撤销资质后全部商品被平台强制下架，待审核申请因资质撤销终止；当前不提供撤销资质的恢复入口。" type="error" :closable="false" />
        <el-alert v-if="action === 'restore'" title="仅恢复经营资格，商品仍需重新上架；平台强制下架商品需整改复审。" type="info" :closable="false" />
        <template v-if="action !== 'restore'"><p>违规原因：</p><el-checkbox-group v-model="reasonIds" class="reason-list"><el-checkbox v-for="item in currentReasons" :key="item.id" :label="item.id">{{ item.label }}</el-checkbox></el-checkbox-group></template>
        <textarea v-model="note" rows="4" maxlength="500" :disabled="submitting" :placeholder="action === 'restore' ? '必填：整改核验结果及恢复经营依据' : '补充说明（选择其他原因时必填）'" />
        <el-input v-if="action === 'revoke'" v-model="confirmation" class="confirmation" :disabled="submitting" placeholder="输入完整店铺名称，确认撤销资质" />
      </div>
      <template #footer><el-button :disabled="submitting" @click="dialogVisible=false">取消</el-button><el-button :type="action === 'restore' ? 'success' : 'danger'" :disabled="!preview || previewLoading" :loading="submitting" @click="submit">确认{{ dialogTitle }}</el-button></template>
    </el-dialog>
    <el-drawer v-model="drawer" :title="`${detailKind === 'reviews' ? '审核' : '处置'}记录 #${detailId}`" size="min(780px,95vw)">
      <div v-loading="detailLoading">
        <el-alert v-if="detailError" :title="detailError" type="error" :closable="false"><el-button link @click="showDetail(detailKind, detailId)">重试</el-button></el-alert>
        <template v-if="recordDetail">
          <el-alert v-if="recordDetail.source === 'enforcement' && detailKind === 'reviews'" title="本申请因店铺资质撤销而终止审核，并非人工审核拒绝。" type="warning" :closable="false" />
          <h3>操作信息</h3>
          <el-descriptions :column="1" border><el-descriptions-item v-for="[key,value] in fields(recordDetail.record)" :key="key" :label="key === 'id' ? '记录编号' : fieldLabels[key]">{{ display(key,value) }}</el-descriptions-item></el-descriptions>
          <p v-if="recordDetail.parent_id">关联处置：<el-button link type="primary" @click="showDetail('records',recordDetail.parent_id)">#{{ recordDetail.parent_id }}</el-button></p>
          <template v-for="section in (['snapshot','current'] as const)" :key="section">
            <h3>{{ section === 'snapshot' ? '操作时的历史快照' : '当前对象信息（可能已经变化）' }}</h3>
            <el-empty v-if="!recordDetail[section]" :description="section === 'snapshot' ? '历史记录未保存快照' : '当前对象已不存在'" :image-size="50" />
            <el-descriptions v-else :column="1" border><el-descriptions-item v-for="[key,value] in fields(recordDetail[section])" :key="key" :label="fieldLabels[key]">{{ display(key,value) }}</el-descriptions-item></el-descriptions>
            <el-image v-for="key in ['picture','qualification_picture'].filter(key => picture(recordDetail?.[section] ?? null,key))" :key="key" class="detail-image" :src="picture(recordDetail[section],key)" :preview-src-list="[picture(recordDetail[section],key)]" preview-teleported fit="contain" />
          </template>
          <h3>关联记录（{{ recordDetail.related.length }}）</h3>
          <p class="muted">包含关联处置、受影响对象及同一对象的后续审核记录。</p>
          <el-table :data="recordDetail.related" max-height="360"><el-table-column prop="id" label="编号" width="80"/><el-table-column prop="name" label="对象"/><el-table-column label="动作"><template #default="scope">{{ statusText(scope.row.action) }}</template></el-table-column><el-table-column width="80"><template #default="scope"><el-button link type="primary" @click="showDetail(scope.row.kind,scope.row.id)">查看</el-button></template></el-table-column></el-table>
        </template>
      </div>
    </el-drawer>
  </div>
</template>

<style scoped>
.filters{padding:16px 16px 0;background:#f8fafc;border-radius:8px;margin-bottom:16px}.pagination{margin-top:20px;justify-content:flex-end}.confirmation{margin-top:16px}.impact,.muted{color:#777}.detail-image{width:140px;height:140px;margin:12px 12px 0 0}.el-alert{margin-bottom:14px}
.heading{display:flex;margin-bottom:16px;align-items:end;justify-content:space-between}.heading h2{margin:0}.heading p{margin:7px 0 0;color:#909399}.goods{display:flex;align-items:center;gap:11px}.goods img{width:46px;height:46px;border-radius:6px;object-fit:cover}.goods small{display:block;margin-top:5px;color:#909399}.role{display:block;margin-top:3px;color:#909399}.reason-list{display:grid;margin:15px 0 20px;grid-template-columns:1fr 1fr;gap:9px}textarea{box-sizing:border-box;width:100%;padding:12px;border:1px solid #dcdfe6;border-radius:5px;font:inherit;resize:vertical}.danger-tip{padding:10px 12px;border-radius:6px;color:#c45656;background:#fef0f0}.page :deep(.el-tabs__content){overflow:visible}@media(max-width:700px){.reason-list{grid-template-columns:1fr}}
</style>
