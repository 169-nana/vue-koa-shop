<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import type {
  AgentEvalCase,
  AgentEvalRunResult,
  AgentKnowledgeInput,
  AgentKnowledgeRecord,
  AgentMetrics,
  AgentPromptVersion,
  AdminAfterSaleApplication,
  AgentSupportTicket,
  RefundStatus
} from '../../../../shared/api'

import {
  createAgentPrompt,
  disableAgentKnowledge,
  getAgentEvalCases,
  getAgentKnowledge,
  getAgentMetrics,
  getAgentPrompts,
  publishAgentPrompt,
  runAgentEvaluation,
  saveAgentEvalCase,
  saveAgentKnowledge,
  getAgentAfterSales,
  decideAgentAfterSale,
  getAgentSupportTickets,
  updateAgentSupportTicket
} from '../../api'
import useAdmin from '../../stores/admin'

type Tab = 'overview' | 'knowledge' | 'prompts' | 'evaluations' | 'service'

const active = ref<Tab>('overview')
const loading = ref(false)
const days = ref<7 | 30 | 90>(7)
const metrics = ref<AgentMetrics | null>(null)
const knowledge = ref<AgentKnowledgeRecord[]>([])
const prompts = ref<AgentPromptVersion[]>([])
const evalCases = ref<AgentEvalCase[]>([])
const afterSales = ref<AdminAfterSaleApplication[]>([])
const supportTickets = ref<AgentSupportTicket[]>([])
const afterSaleStatus = ref<RefundStatus | ''>('pending')
const isAdmin = computed(() => useAdmin().admin.role === 'admin')

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '操作失败，请稍后重试'
}

async function loadMetrics(): Promise<void> {
  loading.value = true
  try { metrics.value = await getAgentMetrics(days.value) }
  catch (error: unknown) { ElMessage.error(errorMessage(error)) }
  finally { loading.value = false }
}

async function loadKnowledge(): Promise<void> {
  loading.value = true
  try { knowledge.value = await getAgentKnowledge() }
  catch (error: unknown) { ElMessage.error(errorMessage(error)) }
  finally { loading.value = false }
}

async function loadPrompts(): Promise<void> {
  loading.value = true
  try { prompts.value = await getAgentPrompts() }
  catch (error: unknown) { ElMessage.error(errorMessage(error)) }
  finally { loading.value = false }
}

async function loadEvalCases(): Promise<void> {
  loading.value = true
  try { evalCases.value = await getAgentEvalCases() }
  catch (error: unknown) { ElMessage.error(errorMessage(error)) }
  finally { loading.value = false }
}

async function loadService(): Promise<void> {
  loading.value = true
  try {
    const [applications, tickets] = await Promise.all([
      getAgentAfterSales(afterSaleStatus.value || undefined),
      getAgentSupportTickets()
    ])
    afterSales.value = applications
    supportTickets.value = tickets
  } catch (error: unknown) { ElMessage.error(errorMessage(error)) }
  finally { loading.value = false }
}

function changeTab(value: string | number): void {
  if (value !== 'overview' && value !== 'knowledge' && value !== 'prompts' && value !== 'evaluations' && value !== 'service') return
  active.value = value
  if (value === 'overview') void loadMetrics()
  if (value === 'knowledge') void loadKnowledge()
  if (value === 'prompts') void loadPrompts()
  if (value === 'evaluations') void loadEvalCases()
  if (value === 'service') void loadService()
}

const funnel = computed(() => {
  const value = metrics.value
  if (!value) return []
  return [
    { label: '推荐商品', value: value.recommended_products },
    { label: '点击商品', value: value.product_clicks },
    { label: '生成确认', value: value.prepared_actions },
    { label: '确认加购', value: value.added_to_cart }
  ]
})
const maxDailyCalls = computed(() => Math.max(1, ...(metrics.value?.daily.map(item => item.calls) ?? [1])))
const afterSaleFunnel = computed(() => {
  const value = metrics.value
  if (!value) return []
  return [
    { label: '资格咨询', value: value.after_sale_consultations },
    { label: '生成确认', value: value.after_sale_prepared },
    { label: '提交申请', value: value.after_sale_submitted },
    { label: '人工工单', value: value.support_tickets }
  ]
})

const knowledgeDialog = ref(false)
const knowledgeSaving = ref(false)
const knowledgeForm = reactive<{
  id?: number
  category: string
  title: string
  keywords: string
  content: string
  enabled: boolean
  sort_order: number
  valid_from: string
  valid_until: string
}>({
  category: '', title: '', keywords: '', content: '', enabled: true,
  sort_order: 100, valid_from: '', valid_until: ''
})

function toDateTimeLocal(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function editKnowledge(item?: AgentKnowledgeRecord): void {
  Object.assign(knowledgeForm, item
    ? {
        id: item.id, category: item.category, title: item.title,
        keywords: item.keywords, content: item.content, enabled: item.enabled,
        sort_order: item.sort_order, valid_from: toDateTimeLocal(item.valid_from),
        valid_until: toDateTimeLocal(item.valid_until)
      }
    : {
        id: undefined, category: '', title: '', keywords: '', content: '',
        enabled: true, sort_order: 100, valid_from: '', valid_until: ''
      })
  knowledgeDialog.value = true
}

async function submitKnowledge(): Promise<void> {
  if (!knowledgeForm.category.trim() || !knowledgeForm.title.trim() || !knowledgeForm.content.trim()) {
    ElMessage.warning('请填写分类、标题和内容')
    return
  }
  knowledgeSaving.value = true
  try {
    const payload: AgentKnowledgeInput = {
      ...knowledgeForm,
      valid_from: knowledgeForm.valid_from || null,
      valid_until: knowledgeForm.valid_until || null
    }
    await saveAgentKnowledge(payload)
    knowledgeDialog.value = false
    ElMessage.success('知识条目已保存')
    await loadKnowledge()
  } catch (error: unknown) { ElMessage.error(errorMessage(error)) }
  finally { knowledgeSaving.value = false }
}

async function archiveKnowledge(item: AgentKnowledgeRecord): Promise<void> {
  try {
    await ElMessageBox.confirm(`停用“${item.title}”后，顾客助手将不再检索这条内容。`, '确认停用')
    await disableAgentKnowledge(item.id)
    ElMessage.success('知识条目已停用')
    await loadKnowledge()
  } catch (error: unknown) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(errorMessage(error))
  }
}

const promptDialog = ref(false)
const promptContent = ref('')
const promptSaving = ref(false)

async function createPrompt(): Promise<void> {
  if (promptContent.value.trim().length < 100) {
    ElMessage.warning('Prompt 至少需要100个字符')
    return
  }
  promptSaving.value = true
  try {
    await createAgentPrompt({ content: promptContent.value.trim() })
    promptDialog.value = false
    promptContent.value = ''
    ElMessage.success('Prompt 草稿已创建，请先运行评测')
    await loadPrompts()
  } catch (error: unknown) { ElMessage.error(errorMessage(error)) }
  finally { promptSaving.value = false }
}

const evalRunningId = ref<number | null>(null)
const evalResult = ref<AgentEvalRunResult | null>(null)
const evalResultDialog = ref(false)

async function runEvaluation(item: AgentPromptVersion): Promise<void> {
  evalRunningId.value = item.id
  try {
    evalResult.value = await runAgentEvaluation(item.id)
    evalResultDialog.value = true
    await loadPrompts()
  } catch (error: unknown) { ElMessage.error(errorMessage(error)) }
  finally { evalRunningId.value = null }
}

async function publishPrompt(item: AgentPromptVersion): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `发布 Prompt v${item.version} 后会替换当前线上版本，运行中请求不受影响。`,
      item.status === 'archived' ? '确认回滚' : '确认发布'
    )
    await publishAgentPrompt(item.id)
    ElMessage.success(item.status === 'archived' ? 'Prompt 已回滚并发布' : 'Prompt 已发布')
    await loadPrompts()
  } catch (error: unknown) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(errorMessage(error))
  }
}

const evalDialog = ref(false)
const evalSaving = ref(false)
const expectedText = ref('')
const forbiddenText = ref('')
const evalForm = reactive({
  id: undefined as number | undefined,
  name: '', question: '', require_tool: false,
  min_product_count: 0, enabled: true, sort_order: 100
})

function editEvalCase(item?: AgentEvalCase): void {
  Object.assign(evalForm, item
    ? {
        id: item.id, name: item.name, question: item.question,
        require_tool: item.require_tool, min_product_count: item.min_product_count,
        enabled: item.enabled, sort_order: item.sort_order
      }
    : {
        id: undefined, name: '', question: '', require_tool: false,
        min_product_count: 0, enabled: true, sort_order: 100
      })
  expectedText.value = item?.expected_keywords.join('，') ?? ''
  forbiddenText.value = item?.forbidden_keywords.join('，') ?? ''
  evalDialog.value = true
}

function keywords(value: string): string[] {
  return [...new Set(value.split(/[,，、\n]+/).map(item => item.trim()).filter(Boolean))]
}

async function submitEvalCase(): Promise<void> {
  if (!evalForm.name.trim() || !evalForm.question.trim()) {
    ElMessage.warning('请填写用例名称和问题')
    return
  }
  evalSaving.value = true
  try {
    await saveAgentEvalCase({
      ...evalForm,
      name: evalForm.name.trim(),
      question: evalForm.question.trim(),
      expected_keywords: keywords(expectedText.value),
      forbidden_keywords: keywords(forbiddenText.value)
    })
    evalDialog.value = false
    ElMessage.success('评测用例已保存')
    await loadEvalCases()
  } catch (error: unknown) { ElMessage.error(errorMessage(error)) }
  finally { evalSaving.value = false }
}

const afterSaleDialog = ref(false)
const afterSaleDecision = reactive({ id: 0, decision: 'approved' as 'approved' | 'rejected', note: '' })

function openAfterSaleDecision(item: AdminAfterSaleApplication, decision: 'approved' | 'rejected'): void {
  Object.assign(afterSaleDecision, { id: item.id, decision, note: '' })
  afterSaleDialog.value = true
}

async function submitAfterSaleDecision(): Promise<void> {
  if (afterSaleDecision.note.trim().length < 2) { ElMessage.warning('请填写处理说明'); return }
  try {
    await decideAgentAfterSale({ ...afterSaleDecision, note: afterSaleDecision.note.trim() })
    afterSaleDialog.value = false
    ElMessage.success('售后申请已处理')
    await loadService()
  } catch (error: unknown) { ElMessage.error(errorMessage(error)) }
}

const ticketDialog = ref(false)
const ticketDecision = reactive({ id: 0, status: 'in_progress' as 'in_progress' | 'resolved', resolution: '' })

function openTicket(item: AgentSupportTicket, status: 'in_progress' | 'resolved'): void {
  Object.assign(ticketDecision, { id: item.id, status, resolution: item.resolution })
  ticketDialog.value = true
}

async function submitTicket(): Promise<void> {
  if (ticketDecision.status === 'resolved' && ticketDecision.resolution.trim().length < 2) {
    ElMessage.warning('完成工单时请填写解决说明')
    return
  }
  try {
    await updateAgentSupportTicket({ ...ticketDecision, resolution: ticketDecision.resolution.trim() })
    ticketDialog.value = false
    ElMessage.success('客服工单已更新')
    await loadService()
  } catch (error: unknown) { ElMessage.error(errorMessage(error)) }
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString() : '—'
}

onMounted(loadMetrics)
</script>

<template>
  <div class="page">
    <div class="heading">
      <div><h2>智能体运营</h2><p>管理知识、Prompt、质量评测和顾客转化数据。</p></div>
      <el-button :loading="loading" @click="changeTab(active)">刷新</el-button>
    </div>

    <el-tabs :model-value="active" @update:model-value="changeTab">
      <el-tab-pane label="运营看板" name="overview">
        <div class="period"><span>统计周期</span><el-select v-model="days" style="width:120px" @change="loadMetrics"><el-option :value="7" label="最近7天"/><el-option :value="30" label="最近30天"/><el-option :value="90" label="最近90天"/></el-select></div>
        <div v-if="metrics" v-loading="loading">
          <section class="metric-grid">
            <article><span>对话次数</span><strong>{{ metrics.calls }}</strong></article>
            <article><span>成功率</span><strong>{{ metrics.success_rate }}%</strong></article>
            <article><span>平均响应</span><strong>{{ metrics.average_duration_ms }}ms</strong></article>
            <article><span>回答反馈</span><strong>{{ metrics.helpful }} / {{ metrics.unhelpful }}</strong><small>有帮助 / 没帮助</small></article>
          </section>
          <section class="panel"><h3>推荐到加购转化</h3><div class="funnel"><article v-for="item in funnel" :key="item.label"><strong>{{ item.value }}</strong><span>{{ item.label }}</span></article></div></section>
          <section class="panel"><h3>售后协同转化</h3><div class="funnel after-sale"><article v-for="item in afterSaleFunnel" :key="item.label"><strong>{{ item.value }}</strong><span>{{ item.label }}</span></article></div></section>
          <div class="two-columns">
            <section class="panel"><h3>每日调用</h3><div v-if="metrics.daily.length" class="bars"><div v-for="item in metrics.daily" :key="item.date"><span>{{ item.date.slice(5) }}</span><i :style="{ height: `${Math.max(5, item.calls / maxDailyCalls * 100)}%` }"></i><b>{{ item.calls }}</b></div></div><el-empty v-else description="暂无调用数据" /></section>
            <section class="panel"><h3>工具调用</h3><el-table :data="metrics.tools" size="small"><el-table-column prop="name" label="工具"/><el-table-column prop="count" label="次数" width="90"/></el-table><h3 class="subheading">失败原因</h3><el-table :data="metrics.errors" size="small"><el-table-column prop="name" label="错误码"/><el-table-column prop="count" label="次数" width="90"/></el-table></section>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="知识库" name="knowledge">
        <div class="toolbar"><p>只有启用且在有效期内的内容会参与顾客回答。</p><el-button v-if="isAdmin" type="primary" @click="editKnowledge()">新增知识</el-button></div>
        <el-table v-loading="loading" :data="knowledge" border stripe row-key="id">
          <el-table-column prop="title" label="标题" min-width="170"/><el-table-column prop="category" label="分类" width="120"/><el-table-column prop="keywords" label="关键词" min-width="180" show-overflow-tooltip/><el-table-column prop="content" label="内容" min-width="260" show-overflow-tooltip/><el-table-column label="状态" width="90"><template #default="scope"><el-tag :type="scope.row.enabled ? 'success' : 'info'">{{ scope.row.enabled ? '启用' : '停用' }}</el-tag></template></el-table-column><el-table-column label="有效期" min-width="220"><template #default="scope">{{ formatDate(scope.row.valid_from) }}<br>{{ formatDate(scope.row.valid_until) }}</template></el-table-column><el-table-column v-if="isAdmin" label="操作" width="130" fixed="right"><template #default="scope"><el-button link type="primary" @click="editKnowledge(scope.row)">编辑</el-button><el-button v-if="scope.row.enabled" link type="danger" @click="archiveKnowledge(scope.row)">停用</el-button></template></el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="Prompt 版本" name="prompts">
        <div class="toolbar"><p>新草稿必须自动评测达到75分，才能发布或回滚。</p><el-button v-if="isAdmin" type="primary" @click="promptDialog = true">新建版本</el-button></div>
        <el-table v-loading="loading" :data="prompts" border stripe row-key="id">
          <el-table-column label="版本" width="90"><template #default="scope">v{{ scope.row.version }}</template></el-table-column><el-table-column label="状态" width="100"><template #default="scope"><el-tag :type="scope.row.status === 'published' ? 'success' : scope.row.status === 'draft' ? 'warning' : 'info'">{{ scope.row.status === 'published' ? '已发布' : scope.row.status === 'draft' ? '草稿' : '已归档' }}</el-tag></template></el-table-column><el-table-column label="评测" width="100"><template #default="scope">{{ scope.row.eval_score === null ? '未评测' : `${scope.row.eval_score}分` }}</template></el-table-column><el-table-column prop="content" label="内容摘要" min-width="300" show-overflow-tooltip/><el-table-column prop="created_by_name" label="创建人" width="120"/><el-table-column label="发布时间" width="180"><template #default="scope">{{ formatDate(scope.row.published_at) }}</template></el-table-column><el-table-column v-if="isAdmin" label="操作" width="190" fixed="right"><template #default="scope"><el-button link type="primary" :loading="evalRunningId === scope.row.id" @click="runEvaluation(scope.row)">运行评测</el-button><el-button v-if="scope.row.status !== 'published'" link type="success" :disabled="scope.row.eval_score === null || scope.row.eval_score < 75" @click="publishPrompt(scope.row)">{{ scope.row.status === 'archived' ? '回滚' : '发布' }}</el-button></template></el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="评测用例" name="evaluations">
        <div class="toolbar"><p>评测会调用当前配置的模型；最多执行20条启用用例。</p><el-button v-if="isAdmin" type="primary" @click="editEvalCase()">新增用例</el-button></div>
        <el-table v-loading="loading" :data="evalCases" border stripe row-key="id"><el-table-column prop="name" label="名称" min-width="170"/><el-table-column prop="question" label="测试问题" min-width="260" show-overflow-tooltip/><el-table-column label="预期关键词" min-width="160"><template #default="scope">{{ scope.row.expected_keywords.join('、') || '—' }}</template></el-table-column><el-table-column label="禁止关键词" min-width="160"><template #default="scope">{{ scope.row.forbidden_keywords.join('、') || '—' }}</template></el-table-column><el-table-column label="要求" width="150"><template #default="scope">{{ scope.row.require_tool ? '调用工具' : '不限工具' }} · 商品≥{{ scope.row.min_product_count }}</template></el-table-column><el-table-column label="状态" width="85"><template #default="scope"><el-tag :type="scope.row.enabled ? 'success' : 'info'">{{ scope.row.enabled ? '启用' : '停用' }}</el-tag></template></el-table-column><el-table-column v-if="isAdmin" label="操作" width="80"><template #default="scope"><el-button link type="primary" @click="editEvalCase(scope.row)">编辑</el-button></template></el-table-column></el-table>
      </el-tab-pane>

      <el-tab-pane label="售后协同" name="service">
        <div class="toolbar"><p>智能体只负责准备申请和工单，最终售后决定由管理员处理。</p><el-select v-model="afterSaleStatus" style="width:130px" @change="loadService"><el-option label="全部申请" value=""/><el-option label="待处理" value="pending"/><el-option label="已同意" value="approved"/><el-option label="已拒绝" value="rejected"/></el-select></div>
        <section class="panel service-panel"><h3>售后申请</h3><el-table v-loading="loading" :data="afterSales" border stripe row-key="id"><el-table-column prop="order_no" label="订单号" width="180"/><el-table-column prop="username" label="顾客" width="110"/><el-table-column label="商品" min-width="180"><template #default="scope">{{ scope.row.goods_name || '整单售后' }}<br><small v-if="scope.row.quantity">数量：{{ scope.row.quantity }}</small></template></el-table-column><el-table-column label="类型/来源" width="130"><template #default="scope">{{ scope.row.request_type === 'return_refund' ? '退货退款' : '仅退款' }}<br><small>{{ scope.row.source === 'agent' ? '智能体协助' : '顾客提交' }}</small></template></el-table-column><el-table-column label="金额" width="100"><template #default="scope">¥{{ scope.row.refund_amount.toFixed(2) }}</template></el-table-column><el-table-column prop="reason" label="原因" min-width="220" show-overflow-tooltip/><el-table-column prop="status" label="状态" width="90"/><el-table-column v-if="isAdmin" label="操作" width="130"><template #default="scope"><template v-if="scope.row.status === 'pending'"><el-button link type="success" @click="openAfterSaleDecision(scope.row, 'approved')">同意</el-button><el-button link type="danger" @click="openAfterSaleDecision(scope.row, 'rejected')">拒绝</el-button></template></template></el-table-column></el-table></section>
        <section class="panel service-panel"><h3>人工客服工单</h3><el-table v-loading="loading" :data="supportTickets" border stripe row-key="id"><el-table-column prop="id" label="编号" width="80"/><el-table-column prop="username" label="顾客" width="110"/><el-table-column prop="order_no" label="关联订单" width="180"/><el-table-column prop="subject" label="主题" min-width="160"/><el-table-column prop="summary" label="问题摘要" min-width="240" show-overflow-tooltip/><el-table-column prop="status" label="状态" width="100"/><el-table-column prop="handler_name" label="处理人" width="110"/><el-table-column v-if="isAdmin" label="操作" width="150"><template #default="scope"><el-button v-if="scope.row.status === 'open'" link type="primary" @click="openTicket(scope.row, 'in_progress')">接单</el-button><el-button v-if="scope.row.status !== 'resolved'" link type="success" @click="openTicket(scope.row, 'resolved')">完成</el-button></template></el-table-column></el-table></section>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="knowledgeDialog" :title="knowledgeForm.id ? '编辑知识' : '新增知识'" width="min(680px,92vw)">
      <el-form label-width="86px">
        <el-form-item label="分类"><input v-model="knowledgeForm.category" class="field" maxlength="40"></el-form-item>
        <el-form-item label="标题"><input v-model="knowledgeForm.title" class="field" maxlength="120"></el-form-item>
        <el-form-item label="关键词"><input v-model="knowledgeForm.keywords" class="field" maxlength="500" placeholder="使用逗号分隔"></el-form-item>
        <el-form-item label="内容"><textarea v-model="knowledgeForm.content" class="field textarea" rows="7" maxlength="5000"></textarea></el-form-item>
        <el-form-item label="有效期"><input v-model="knowledgeForm.valid_from" class="field date" type="datetime-local"> 至 <input v-model="knowledgeForm.valid_until" class="field date" type="datetime-local"></el-form-item>
        <el-form-item label="排序"><input v-model.number="knowledgeForm.sort_order" class="field number" type="number" min="0" max="100000"></el-form-item>
        <el-form-item label="启用"><input v-model="knowledgeForm.enabled" type="checkbox"></el-form-item>
      </el-form>
      <template #footer><el-button @click="knowledgeDialog = false">取消</el-button><el-button type="primary" :loading="knowledgeSaving" @click="submitKnowledge">保存</el-button></template>
    </el-dialog>

    <el-dialog v-model="promptDialog" title="创建 Prompt 草稿" width="min(760px,94vw)"><el-alert title="API Key 和服务器配置不得写入 Prompt。创建后需先评测再发布。" type="warning" :closable="false"/><textarea v-model="promptContent" class="field prompt-editor" rows="18" maxlength="12000"></textarea><template #footer><el-button @click="promptDialog = false">取消</el-button><el-button type="primary" :loading="promptSaving" @click="createPrompt">创建草稿</el-button></template></el-dialog>

    <el-dialog v-model="evalDialog" :title="evalForm.id ? '编辑评测用例' : '新增评测用例'" width="min(680px,92vw)">
      <el-form label-width="100px">
        <el-form-item label="名称"><input v-model="evalForm.name" class="field" maxlength="120"></el-form-item>
        <el-form-item label="测试问题"><textarea v-model="evalForm.question" class="field textarea" rows="4" maxlength="1000"></textarea></el-form-item>
        <el-form-item label="预期关键词"><input v-model="expectedText" class="field" placeholder="多个关键词使用逗号分隔"></el-form-item>
        <el-form-item label="禁止关键词"><input v-model="forbiddenText" class="field" placeholder="多个关键词使用逗号分隔"></el-form-item>
        <el-form-item label="要求调用工具"><input v-model="evalForm.require_tool" type="checkbox"></el-form-item>
        <el-form-item label="最少商品数"><input v-model.number="evalForm.min_product_count" class="field number" type="number" min="0" max="8"></el-form-item>
        <el-form-item label="排序"><input v-model.number="evalForm.sort_order" class="field number" type="number" min="0" max="100000"></el-form-item>
        <el-form-item label="启用"><input v-model="evalForm.enabled" type="checkbox"></el-form-item>
      </el-form>
      <template #footer><el-button @click="evalDialog = false">取消</el-button><el-button type="primary" :loading="evalSaving" @click="submitEvalCase">保存</el-button></template>
    </el-dialog>

    <el-dialog v-model="evalResultDialog" title="自动评测结果" width="min(820px,94vw)"><div v-if="evalResult"><el-result :icon="evalResult.score >= 75 ? 'success' : 'error'" :title="`${evalResult.score}分`" :sub-title="`${evalResult.passed}/${evalResult.total} 条通过`"/><el-table :data="evalResult.results" border><el-table-column prop="name" label="用例" width="180"/><el-table-column label="结果" width="85"><template #default="scope"><el-tag :type="scope.row.passed ? 'success' : 'danger'">{{ scope.row.passed ? '通过' : '失败' }}</el-tag></template></el-table-column><el-table-column prop="answer" label="回答摘要" min-width="260" show-overflow-tooltip/><el-table-column label="原因" min-width="150"><template #default="scope">{{ scope.row.reasons.join('、') || '—' }}</template></el-table-column></el-table></div></el-dialog>
    <el-dialog v-model="afterSaleDialog" :title="afterSaleDecision.decision === 'approved' ? '同意售后申请' : '拒绝售后申请'" width="min(520px,92vw)"><textarea v-model="afterSaleDecision.note" class="field textarea" rows="5" maxlength="500" placeholder="填写处理说明，顾客可在售后页面查看"></textarea><template #footer><el-button @click="afterSaleDialog = false">取消</el-button><el-button :type="afterSaleDecision.decision === 'approved' ? 'success' : 'danger'" @click="submitAfterSaleDecision">确认处理</el-button></template></el-dialog>
    <el-dialog v-model="ticketDialog" :title="ticketDecision.status === 'resolved' ? '完成客服工单' : '接手客服工单'" width="min(520px,92vw)"><textarea v-model="ticketDecision.resolution" class="field textarea" rows="5" maxlength="500" :placeholder="ticketDecision.status === 'resolved' ? '填写解决说明' : '可填写初步处理备注'"></textarea><template #footer><el-button @click="ticketDialog = false">取消</el-button><el-button type="primary" @click="submitTicket">确认</el-button></template></el-dialog>
  </div>
</template>

<style scoped>
.page { padding: 4px; color: #27364a; }
.heading, .toolbar, .period { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.heading { margin-bottom: 16px; }
.heading h2 { margin: 0 0 6px; font-size: 24px; }
.heading p, .toolbar p { margin: 0; color: #7b8798; font-size: 13px; }
.period { justify-content: flex-end; margin-bottom: 16px; color: #647187; font-size: 13px; }
.metric-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.metric-grid article, .panel { padding: 20px; border: 1px solid #e7ebf0; border-radius: 12px; background: #fff; }
.metric-grid span { display: block; color: #78869a; font-size: 13px; }
.metric-grid strong { display: block; margin-top: 10px; color: #213c62; font-size: 27px; }
.metric-grid small { color: #9aa4b2; }
.panel { margin-top: 16px; }
.panel h3 { margin: 0 0 18px; font-size: 16px; }
.funnel { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2px; }
.funnel article { display: grid; min-height: 90px; place-content: center; text-align: center; color: #fff; background: linear-gradient(135deg, #3378c5, #61a0df); clip-path: polygon(4% 0, 100% 0, 96% 100%, 0 100%); }
.funnel.after-sale article { background: linear-gradient(135deg, #247b68, #55a88c); }
.funnel strong { font-size: 24px; }
.funnel span { margin-top: 4px; font-size: 12px; }
.two-columns { display: grid; grid-template-columns: 1.3fr 1fr; gap: 16px; }
.bars { display: flex; height: 220px; align-items: end; gap: 8px; }
.bars div { display: grid; height: 100%; flex: 1; grid-template-rows: 18px 1fr 18px; align-items: end; text-align: center; color: #8a95a5; font-size: 10px; }
.bars i { display: block; width: 65%; min-height: 5px; margin: auto auto 0; border-radius: 5px 5px 0 0; background: #4c91d7; }
.bars b { color: #58677b; font-size: 11px; }
.subheading { margin-top: 22px !important; }
.toolbar { min-height: 48px; margin-bottom: 12px; }
.prompt-editor { margin-top: 14px; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
.field { box-sizing: border-box; width: 100%; padding: 9px 11px; border: 1px solid #d7dce3; border-radius: 5px; color: #303b4b; background: #fff; font: inherit; outline: none; }
.field:focus { border-color: #409eff; }
.textarea { resize: vertical; line-height: 1.6; }
.date { width: 220px; }
.number { width: 150px; }
.service-panel small { color: #8995a5; }
@media (max-width: 900px) { .metric-grid { grid-template-columns: repeat(2, 1fr); } .two-columns { grid-template-columns: 1fr; } }
</style>
