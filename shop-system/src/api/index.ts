import type { GovernanceQuery, GovernancePage, GovernancePreview, GovernanceRecordDetail } from '../../../shared/api'
import request from '../utils/request'
import config from '../config'
import type { ChangeAdminPasswordInput, UploadResult } from '../../../shared/api'
import type { AdminAccount, CreateAdminAccountInput, Credentials, LoginResult, PublicAdmin, Category, CategoryInput, IdInput, InsertResult, GoodsInput, GoodsDetail, GoodsListItem, GoodsQuery, PageResult, GoodsSubmission, MerchantApplication, RejectionReasonOption, ReviewInput, ReviewScene, UpdateAdminAccountInput } from '../../../shared/api'
import type { EnforcementGoods, EnforcementInput, EnforcementRecord, EnforcementScene, ReviewRecord } from '../../../shared/api'
import type {
  AgentEvalCase,
  AgentEvalCaseInput,
  AgentEvalRunResult,
  AgentKnowledgeInput,
  AgentKnowledgeRecord,
  AgentMetrics,
  AgentPromptInput,
  AgentPromptVersion
} from '../../../shared/api'
export const login = (data: Credentials) => request.post<LoginResult>('/admin/login', data)
export const getAdmin = () => request.get<PublicAdmin>('/admin/admin')
export const changeAdminPassword = (data: ChangeAdminPasswordInput) => request.post<null>('/admin/admin/changePassword', data)
export const uploadAdminAvatar = (file: File) => {
  const data = new FormData()
  data.append('type', 'admin_avatar')
  data.append('file', file)
  return request.post<UploadResult>('/admin/upload/picture', data)
}
export const changeAdminAvatar = (data: { avatar: string }) => request.post<{ avatar: string }>('/admin/admin/changeAvatar', data)
export const uploadPictureURL = () => config.baseURL + '/admin/upload/picture'
export const getCategoryList = () => request.get<Category[]>('/admin/category/list')
export const getCategory = (params: IdInput) => request.get<Category>('/admin/category/', { params })
export const addCategory = (data: CategoryInput) => request.post<InsertResult>('/admin/category/add', data)
export const editCategory = (data: Category) => request.post<Category>('/admin/category/save', data)
export const delCategory = (data: IdInput) => request.post<IdInput>('/admin/category/del', data)
export const getGoodsList = (params: GoodsQuery) => request.get<PageResult<GoodsListItem>>('/admin/goods/list', { params })
export const getGoods = (params: IdInput) => request.get<GoodsDetail>('/admin/goods', { params })
export const addGoods = (data: GoodsInput) => request.post<InsertResult>('/admin/goods/add', data)
export const editGoods = (data: GoodsInput & IdInput) => request.post<IdInput>('/admin/goods/save', data)
export const delGoods = (data: IdInput) => request.post<IdInput>('/admin/goods/del', data)
export const getReviewReasons = (scene: ReviewScene) => request.get<RejectionReasonOption[]>('/admin/review/reasons', { params: { scene } })
export const getMerchantApplications = (status?: string) => request.get<MerchantApplication[]>('/admin/review/merchants', { params: status ? { status } : {} })
export const reviewMerchantApplication = (data: ReviewInput) => request.post<null>('/admin/review/merchants/decision', data)
export const getGoodsSubmissions = (status?: string) => request.get<GoodsSubmission[]>('/admin/review/goods', { params: status ? { status } : {} })
export const reviewGoodsSubmission = (data: ReviewInput) => request.post<null>('/admin/review/goods/decision', data)
export const getGovernanceGoods = (params: GovernanceQuery) => request.get<GovernancePage<EnforcementGoods>>('/admin/governance/goods', { params })
export const getGovernanceMerchants = (params: GovernanceQuery) => request.get<GovernancePage<MerchantApplication>>('/admin/governance/merchants', { params })
export const getEnforcementReasons = (scene: EnforcementScene) => request.get<RejectionReasonOption[]>('/admin/governance/reasons', { params: { scene } })
export const enforceBusiness = (data: EnforcementInput) => request.post<null>('/admin/governance/enforce', data)
export const getReviewRecords = (params: GovernanceQuery) => request.get<GovernancePage<ReviewRecord>>('/admin/governance/review-records', { params })
export const getEnforcementRecords = (params: GovernanceQuery) => request.get<GovernancePage<EnforcementRecord>>('/admin/governance/enforcement-records', { params })
export const getAdminAccounts = () => request.get<AdminAccount[]>('/admin/accounts/list')
export const createAdminAccount = (data: CreateAdminAccountInput) => request.post<InsertResult>('/admin/accounts/add', data)
export const updateAdminAccount = (data: UpdateAdminAccountInput) => request.post<UpdateAdminAccountInput>('/admin/accounts/update', data)

export const getGovernancePreview = (type: 'goods' | 'merchant', id: number) => request.get<GovernancePreview>('/admin/governance/preview', { params: { type, id } })
export const getGovernanceDetail = (kind: 'reviews' | 'records', id: number) => request.get<GovernanceRecordDetail>('/admin/governance/detail', { params: { kind, id } })

export const getAgentMetrics = (days: 7 | 30 | 90) =>
  request.get<AgentMetrics>('/admin/agent/metrics', { params: { days } })
export const getAgentKnowledge = () =>
  request.get<AgentKnowledgeRecord[]>('/admin/agent/knowledge')
export const saveAgentKnowledge = (data: AgentKnowledgeInput) =>
  request.post<InsertResult>('/admin/agent/knowledge/save', data)
export const disableAgentKnowledge = (id: number) =>
  request.post<null>('/admin/agent/knowledge/disable', { id })
export const getAgentPrompts = () =>
  request.get<AgentPromptVersion[]>('/admin/agent/prompts')
export const createAgentPrompt = (data: AgentPromptInput) =>
  request.post<InsertResult>('/admin/agent/prompts/create', data)
export const publishAgentPrompt = (id: number) =>
  request.post<null>('/admin/agent/prompts/publish', { id })
export const getAgentEvalCases = () =>
  request.get<AgentEvalCase[]>('/admin/agent/eval-cases')
export const saveAgentEvalCase = (data: AgentEvalCaseInput) =>
  request.post<InsertResult>('/admin/agent/eval-cases/save', data)
export const runAgentEvaluation = (promptVersionId: number) =>
  request.post<AgentEvalRunResult>('/admin/agent/evaluations/run', {
    prompt_version_id: promptVersionId
  }, { timeout: 180000 })
