<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'

import type {
  Goods,
  ShopAgentConversation,
  ShopAgentHistoryMessage,
  ShopAgentMessage,
  ShopAgentPendingAction
} from '../../../shared/api'

import {
  confirmAgentAddToCart,
  confirmAgentAfterSale,
  confirmAgentSupportTicket,
  cancelShopAgentRequest,
  clearShopAgentHistory,
  createShopAgentConversation,
  deleteShopAgentConversation,
  getShopAgentHistory,
  getShopAgentConversations,
  submitAgentFeedback,
  streamWithShopAgent,
  trackAgentProductClick
} from '../api'
import { toAssetURL } from '../config'
import useTokenStore from '../stores/token'

interface DisplayMessage extends ShopAgentMessage {
  key: string
  serverId?: number
  products?: Goods[]
  failed?: boolean
  pendingAction?: ShopAgentPendingAction
  actionResult?: { message: string; path: string | null }
  requestId?: string
  feedback?: 'helpful' | 'unhelpful'
  actionExpired?: boolean
}

const WELCOME: DisplayMessage = {
  key: 'welcome',
  role: 'assistant',
  content: '你好，我可以帮你挑选商品、查询库存，也可以在登录后查询你的订单。'
}
const STORAGE_PREFIX = 'shop_agent_messages_v1:'
const QUICK_PROMPTS = ['推荐一些热卖商品', '对比刚才推荐的商品', '查看我的购物车', '配送和运费怎么算？']

const tokenStore = useTokenStore()
const opened = ref(false)
const input = ref('')
const loading = ref(false)
const loadingHistory = ref(false)
const loadingConversations = ref(false)
const clearingHistory = ref(false)
const confirmingToken = ref('')
const messageList = ref<HTMLElement | null>(null)
const messages = ref<DisplayMessage[]>([])
const conversations = ref<ShopAgentConversation[]>([])
const activeConversationId = ref<number | null>(null)
const hasMoreHistory = ref(false)
const nextBeforeId = ref<number | null>(null)
let activeRequest: AbortController | null = null
let activeRequestId: string | null = null
let historyInitialized = false
let conversationsInitialized = false
let messageSequence = 0

function displayMessage(role: ShopAgentMessage['role'], content: string): DisplayMessage {
  messageSequence += 1
  return { key: `local:${messageSequence}`, role, content }
}

function welcomeMessage(): DisplayMessage {
  return { ...WELCOME }
}

function showAssistantError(error: unknown, fallback: string): void {
  messages.value.push({
    ...displayMessage('assistant', error instanceof Error ? error.message : fallback),
    failed: true
  })
}

function historyMessage(message: ShopAgentHistoryMessage): DisplayMessage {
  const preparedAction = message.action?.status === 'prepared' && message.action.token
    ? {
        type: message.action.type,
        token: message.action.token,
        title: message.action.title,
        description: message.action.description,
        expires_at: message.action.expires_at
      } as ShopAgentPendingAction
    : undefined
  const actionResult = message.action && message.action.status !== 'prepared'
    ? {
        message: message.action.status === 'succeeded'
          ? '该操作已完成'
          : message.action.status === 'executing'
            ? '该操作正在处理中'
            : message.action.status === 'expired'
              ? '确认操作已过期，请重新向助手发起'
              : '该操作执行失败，请重新向助手发起',
        path: null
      }
    : undefined
  const display: DisplayMessage = {
    key: `server:${message.id}`,
    serverId: message.id,
    role: message.role,
    content: message.content,
    ...(message.role === 'assistant' ? { requestId: message.request_id } : {}),
    ...(preparedAction ? { pendingAction: preparedAction } : {}),
    ...(actionResult ? { actionResult } : {}),
    ...(preparedAction && Date.parse(preparedAction.expires_at) <= Date.now()
      ? { actionExpired: true }
      : {})
  }
  if (preparedAction && !display.actionExpired) {
    const expiresIn = Math.max(0, Date.parse(preparedAction.expires_at) - Date.now())
    window.setTimeout(() => {
      if (display.pendingAction?.token === preparedAction.token) display.actionExpired = true
    }, expiresIn + 50)
  }
  return display
}

function identityHash(value: string): string {
  let hash = 2166136261
  for (const character of value) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function storageKey(): string {
  return `${STORAGE_PREFIX}${tokenStore.token ? identityHash(tokenStore.token) : 'guest'}`
}

function loadMessages(): void {
  if (tokenStore.token) {
    messages.value = [welcomeMessage()]
    return
  }
  const saved = localStorage.getItem(storageKey())
  if (!saved) {
    messages.value = [welcomeMessage()]
    return
  }

  try {
    const parsed: unknown = JSON.parse(saved)
    messages.value = Array.isArray(parsed) && parsed.length > 0
      ? parsed.filter((item): item is ShopAgentMessage =>
          typeof item === 'object' &&
          item !== null &&
          'role' in item &&
          (item.role === 'user' || item.role === 'assistant') &&
          'content' in item &&
          typeof item.content === 'string'
        ).slice(-30).map(message => displayMessage(message.role, message.content))
      : [welcomeMessage()]
  } catch {
    messages.value = [welcomeMessage()]
  }
}

function saveMessages(): void {
  if (tokenStore.token) return
  const completed = messages.value
    .filter(message => message.content && !message.failed)
    .map(({ role, content }) => ({ role, content }))
    .slice(-30)
  localStorage.setItem(storageKey(), JSON.stringify(completed))
}

loadMessages()
watch(messages, saveMessages, { deep: true })
watch(() => tokenStore.token, () => {
  void handleIdentityChange()
})

const canSend = computed(() =>
  input.value.trim().length > 0 &&
  !loading.value &&
  !loadingHistory.value &&
  (!tokenStore.token || activeConversationId.value !== null)
)

async function scrollToBottom(): Promise<void> {
  await nextTick()
  if (messageList.value) messageList.value.scrollTop = messageList.value.scrollHeight
}

function resetHistoryState(): void {
  historyInitialized = false
  hasMoreHistory.value = false
  nextBeforeId.value = null
}

async function ensureConversation(): Promise<void> {
  if (!tokenStore.token || conversationsInitialized || loadingConversations.value) return
  const requestToken = tokenStore.token
  loadingConversations.value = true
  try {
    let available = await getShopAgentConversations()
    if (requestToken !== tokenStore.token) return
    if (available.length === 0) available = [await createShopAgentConversation()]
    if (requestToken !== tokenStore.token) return
    conversations.value = available
    activeConversationId.value = available[0]?.id ?? null
    conversationsInitialized = true
  } catch (error: unknown) {
    showAssistantError(error, '对话列表加载失败，请稍后重试。')
  } finally {
    loadingConversations.value = false
  }
}

async function loadRecentHistory(): Promise<void> {
  const conversationId = activeConversationId.value
  if (!tokenStore.token || conversationId === null || historyInitialized || loadingHistory.value) return
  const requestToken = tokenStore.token
  loadingHistory.value = true
  try {
    const page = await getShopAgentHistory(conversationId)
    if (requestToken !== tokenStore.token || conversationId !== activeConversationId.value) return
    messages.value = page.list.length > 0
      ? page.list.map(historyMessage)
      : [welcomeMessage()]
    hasMoreHistory.value = page.hasMore
    nextBeforeId.value = page.nextBeforeId
  } catch {
    hasMoreHistory.value = false
    nextBeforeId.value = null
  } finally {
    if (requestToken === tokenStore.token && conversationId === activeConversationId.value) historyInitialized = true
    loadingHistory.value = false
  }
}

async function loadOlderHistory(): Promise<void> {
  const list = messageList.value
  const beforeId = nextBeforeId.value
  const conversationId = activeConversationId.value
  if (
    !list ||
    !tokenStore.token ||
    conversationId === null ||
    !historyInitialized ||
    !hasMoreHistory.value ||
    beforeId === null ||
    loadingHistory.value
  ) return

  const requestToken = tokenStore.token
  const previousHeight = list.scrollHeight
  loadingHistory.value = true
  try {
    const page = await getShopAgentHistory(conversationId, beforeId)
    if (requestToken !== tokenStore.token || conversationId !== activeConversationId.value) return
    const existingIds = new Set(
      messages.value.flatMap(message => message.serverId === undefined ? [] : [message.serverId])
    )
    const olderMessages = page.list
      .filter(message => !existingIds.has(message.id))
      .map(historyMessage)
    messages.value = [...olderMessages, ...messages.value]
    hasMoreHistory.value = page.hasMore
    nextBeforeId.value = page.nextBeforeId
    await nextTick()
    if (messageList.value) {
      messageList.value.scrollTop += messageList.value.scrollHeight - previousHeight
    }
  } catch {
    // 历史加载失败不影响当前对话，用户再次上拉时可以重试。
  } finally {
    loadingHistory.value = false
  }
}

function handleHistoryScroll(): void {
  if ((messageList.value?.scrollTop ?? 100) <= 32) void loadOlderHistory()
}

async function toggleAssistant(): Promise<void> {
  if (opened.value) {
    opened.value = false
    return
  }
  opened.value = true
  await ensureConversation()
  await loadRecentHistory()
  await scrollToBottom()
}

async function handleIdentityChange(): Promise<void> {
  stopGenerating()
  conversations.value = []
  activeConversationId.value = null
  conversationsInitialized = false
  resetHistoryState()
  loadMessages()
  if (opened.value) {
    await ensureConversation()
    await loadRecentHistory()
    await scrollToBottom()
  }
}

async function switchConversation(): Promise<void> {
  if (loading.value) stopGenerating()
  resetHistoryState()
  messages.value = [welcomeMessage()]
  await loadRecentHistory()
  await scrollToBottom()
}

async function createConversation(): Promise<void> {
  if (!tokenStore.token || loadingConversations.value) return
  loadingConversations.value = true
  try {
    const conversation = await createShopAgentConversation()
    conversations.value = [conversation, ...conversations.value]
    activeConversationId.value = conversation.id
    resetHistoryState()
    historyInitialized = true
    messages.value = [welcomeMessage()]
    await scrollToBottom()
  } catch (error: unknown) {
    showAssistantError(error, '新建对话失败，请稍后重试。')
  } finally {
    loadingConversations.value = false
  }
}

async function deleteConversation(): Promise<void> {
  const conversationId = activeConversationId.value
  if (!tokenStore.token || conversationId === null || loadingConversations.value) return
  if (!window.confirm('删除当前对话及其聊天记录？')) return
  loadingConversations.value = true
  try {
    await deleteShopAgentConversation(conversationId)
    conversations.value = conversations.value.filter(item => item.id !== conversationId)
    activeConversationId.value = conversations.value[0]?.id ?? null
    if (conversations.value.length === 0) {
      conversations.value = [await createShopAgentConversation()]
    }
    activeConversationId.value = conversations.value[0]?.id ?? null
    resetHistoryState()
    await loadRecentHistory()
    await scrollToBottom()
  } catch (error: unknown) {
    showAssistantError(error, '删除对话失败，请稍后重试。')
  } finally {
    loadingConversations.value = false
  }
}

function updateActiveConversationTitle(content: string): void {
  const index = conversations.value.findIndex(item => item.id === activeConversationId.value)
  const conversation = conversations.value[index]
  if (!conversation) return
  const compact = content.replace(/\s+/g, ' ').trim()
  const title = compact.length > 24 ? `${compact.slice(0, 24)}…` : compact
  conversations.value.splice(index, 1)
  conversations.value.unshift({ ...conversation, title: conversation.title === '新对话' ? title : conversation.title })
}

async function sendMessage(preset?: string): Promise<void> {
  const content = (preset ?? input.value).trim()
  if (!content || loading.value) return

  messages.value.push(displayMessage('user', content))
  input.value = ''
  loading.value = true
  // Stream callbacks must mutate the same reactive proxy that the template reads.
  // Mutating a raw object after pushing it into a reactive array can miss updates.
  const assistantMessage = reactive<DisplayMessage>(displayMessage('assistant', ''))
  messages.value.push(assistantMessage)
  activeRequest = new AbortController()
  await scrollToBottom()

  try {
    const history = messages.value
      .slice(0, -1)
      .filter(message => message.content && !message.failed)
      .slice(-12)
      .map(({ role, content: messageContent }) => ({ role, content: messageContent }))

    await streamWithShopAgent(
      {
        messages: history,
        ...(activeConversationId.value === null ? {} : { conversation_id: activeConversationId.value })
      },
      tokenStore.token,
      {
        onMeta: requestId => {
          assistantMessage.requestId = requestId
          activeRequestId = requestId
        },
        onDelta: chunk => {
          assistantMessage.content += chunk
          void scrollToBottom()
        },
        onReset: () => {
          assistantMessage.content = ''
          assistantMessage.products = undefined
        },
        onProducts: products => {
          assistantMessage.products = products
        },
        onAction: action => {
          assistantMessage.pendingAction = action
          const expiresIn = Math.max(0, Date.parse(action.expires_at) - Date.now())
          window.setTimeout(() => {
            if (assistantMessage.pendingAction?.token === action.token) assistantMessage.actionExpired = true
          }, expiresIn + 50)
        }
      },
      activeRequest.signal
    )

    if (!assistantMessage.content) assistantMessage.content = '暂时没有找到合适的回答。'
    if (tokenStore.token) updateActiveConversationTitle(content)
  } catch (error: unknown) {
    assistantMessage.content = error instanceof DOMException && error.name === 'AbortError'
      ? '已停止生成。'
      : error instanceof Error
        ? error.message
        : '智能助手暂时不可用，请稍后重试。'
    assistantMessage.failed = !(error instanceof DOMException && error.name === 'AbortError')
  } finally {
    loading.value = false
    activeRequest = null
    activeRequestId = null
    await scrollToBottom()
  }
}

async function confirmAction(message: DisplayMessage): Promise<void> {
  const action = message.pendingAction
  if (!action || confirmingToken.value) return
  if (message.actionExpired || Date.parse(action.expires_at) <= Date.now()) {
    message.actionResult = { message: '确认操作已过期，请重新向助手发起', path: null }
    message.pendingAction = undefined
    return
  }
  confirmingToken.value = action.token
  try {
    if (action.type === 'add_to_cart') {
      const result = await confirmAgentAddToCart({ token: action.token })
      message.actionResult = { message: result.message, path: result.cart_path }
    } else if (action.type === 'apply_after_sale') {
      const result = await confirmAgentAfterSale({ token: action.token })
      message.actionResult = { message: result.message, path: result.after_sale_path }
    } else {
      const result = await confirmAgentSupportTicket({ token: action.token })
      message.actionResult = { message: `${result.message}（编号 ${result.ticket_id}）`, path: null }
    }
    message.pendingAction = undefined
  } catch (error: unknown) {
    message.actionResult = {
      message: error instanceof Error ? error.message : '操作失败，请重新发起',
      path: null
    }
    message.pendingAction = undefined
  } finally {
    confirmingToken.value = ''
  }
}

function actionButtonText(action: ShopAgentPendingAction): string {
  if (action.type === 'add_to_cart') return '确认加入购物车'
  if (action.type === 'apply_after_sale') return '确认提交售后申请'
  return '确认创建人工工单'
}

function stopGenerating(): void {
  activeRequest?.abort()
  const requestId = activeRequestId
  activeRequestId = null
  if (requestId && tokenStore.token) {
    void cancelShopAgentRequest({ request_id: requestId }).catch(() => undefined)
  }
}

async function clearConversation(): Promise<void> {
  if (clearingHistory.value) return
  if (loading.value) stopGenerating()
  clearingHistory.value = true
  try {
    if (tokenStore.token && activeConversationId.value !== null) {
      await clearShopAgentHistory(activeConversationId.value)
    }
    messages.value = [welcomeMessage()]
    localStorage.removeItem(storageKey())
    historyInitialized = Boolean(tokenStore.token)
    hasMoreHistory.value = false
    nextBeforeId.value = null
    const conversation = conversations.value.find(item => item.id === activeConversationId.value)
    if (conversation) conversation.title = '新对话'
  } catch (error: unknown) {
    showAssistantError(error, '聊天记录清空失败，请稍后重试。')
  } finally {
    clearingHistory.value = false
    await scrollToBottom()
  }
}

function handleProductClick(goodsId: number): void {
  opened.value = false
  void trackAgentProductClick(goodsId, Boolean(tokenStore.token)).catch(() => undefined)
}

async function sendFeedback(
  message: DisplayMessage,
  rating: 'helpful' | 'unhelpful'
): Promise<void> {
  if (!message.requestId || message.feedback) return
  try {
    await submitAgentFeedback(
      { request_id: message.requestId, rating },
      Boolean(tokenStore.token)
    )
    message.feedback = rating
  } catch {
    // 反馈失败不打断顾客继续聊天。
  }
}
</script>

<template>
  <button
    class="assistant-trigger"
    type="button"
    :aria-expanded="opened"
    aria-label="打开智能导购"
    @click="toggleAssistant"
  >
    AI
  </button>

  <aside v-if="opened" class="assistant-panel" aria-label="智能导购对话框">
    <header>
      <div>
        <strong>智能导购</strong>
        <small>商品、订单与商城规则助手</small>
      </div>
      <nav>
        <button type="button" aria-label="清空对话" title="清空对话" :disabled="clearingHistory" @click="clearConversation">↻</button>
        <button type="button" aria-label="关闭" @click="opened = false">×</button>
      </nav>
    </header>

    <div class="conversation-bar">
      <template v-if="tokenStore.token">
        <select v-model.number="activeConversationId" :disabled="loadingConversations || loading" aria-label="选择对话" @change="switchConversation">
          <option v-for="conversation in conversations" :key="conversation.id" :value="conversation.id">
            {{ conversation.title }}
          </option>
        </select>
        <button type="button" :disabled="loadingConversations || loading" title="新建对话" @click="createConversation">＋</button>
        <button type="button" :disabled="loadingConversations || loading" title="删除当前对话" @click="deleteConversation">删除</button>
      </template>
      <small v-else>游客对话仅保存在当前浏览器</small>
    </div>

    <div ref="messageList" class="message-list" aria-live="polite" @scroll.passive="handleHistoryScroll">
      <div v-if="loadingHistory" class="history-status">正在加载聊天记录…</div>
      <article
        v-for="message in messages"
        :key="message.key"
        :class="[message.role, { failed: message.failed }]"
      >
        <p>{{ message.content || '正在思考…' }}</p>
        <div v-if="message.products?.length" class="product-list">
          <RouterLink
            v-for="product in message.products"
            :key="product.id"
            :to="{ name: 'goods-detail', params: { id: product.id } }"
            @click="handleProductClick(product.id)"
          >
            <img :src="toAssetURL(product.picture)" :alt="product.name">
            <span>
              <b>{{ product.name }}</b>
              <small>¥{{ product.price.toFixed(2) }} · 库存 {{ product.stock }}</small>
            </span>
          </RouterLink>
        </div>
        <section v-if="message.pendingAction" class="action-card">
          <strong>{{ message.pendingAction.title }}</strong>
          <span>{{ message.pendingAction.description }}</span>
          <button
            type="button"
            :disabled="Boolean(confirmingToken) || message.actionExpired"
            @click="confirmAction(message)"
          >
            {{ message.actionExpired ? '确认已过期' : confirmingToken === message.pendingAction.token ? '处理中…' : actionButtonText(message.pendingAction) }}
          </button>
        </section>
        <RouterLink v-if="message.actionResult?.path" class="action-result" :to="message.actionResult.path" @click="opened = false">
          {{ message.actionResult.message }}，查看详情 →
        </RouterLink>
        <span v-else-if="message.actionResult" class="action-result">{{ message.actionResult.message }}</span>
        <div v-if="message.requestId && !message.failed" class="feedback">
          <span>{{ message.feedback ? '感谢反馈' : '这个回答有帮助吗？' }}</span>
          <template v-if="!message.feedback">
            <button type="button" aria-label="有帮助" @click="sendFeedback(message, 'helpful')">👍</button>
            <button type="button" aria-label="没帮助" @click="sendFeedback(message, 'unhelpful')">👎</button>
          </template>
        </div>
      </article>

      <div v-if="messages.length === 1" class="quick-prompts">
        <button
          v-for="prompt in QUICK_PROMPTS"
          :key="prompt"
          type="button"
          :disabled="loading"
          @click="sendMessage(prompt)"
        >
          {{ prompt }}
        </button>
      </div>
    </div>

    <form @submit.prevent="sendMessage()">
      <textarea
        v-model="input"
        maxlength="500"
        rows="2"
        placeholder="例如：推荐200元以内的耳机"
        aria-label="输入问题"
        @keydown.enter.exact.prevent="sendMessage()"
      />
      <button v-if="loading" class="stop" type="button" @click="stopGenerating">停止</button>
      <button v-else type="submit" :disabled="!canSend">发送</button>
    </form>
    <footer>AI 回答可能有误，价格、库存与政策以对应页面为准。</footer>
  </aside>
</template>

<style scoped>
.assistant-trigger { position: fixed; right: 24px; bottom: 24px; z-index: 80; width: 56px; height: 56px; border: 0; border-radius: 50%; color: #fff; background: linear-gradient(145deg, #285f49, #4b8d6b); box-shadow: 0 12px 30px rgba(28, 72, 51, .3); font-weight: 800; cursor: pointer; }
.assistant-panel { position: fixed; right: 24px; bottom: 92px; z-index: 80; display: grid; width: min(390px, calc(100vw - 24px)); height: min(620px, calc(100vh - 120px)); grid-template-rows: auto auto 1fr auto auto; overflow: hidden; border: 1px solid #dce7df; border-radius: 20px; background: #f8faf8; box-shadow: 0 22px 60px rgba(28, 54, 40, .22); }
header { display: flex; padding: 17px 18px; align-items: center; justify-content: space-between; color: white; background: #2d6a4f; }
header div { display: grid; gap: 3px; }
header strong { font-size: 17px; }
header small { color: #dcebe2; font-size: 11px; }
header nav { display: flex; gap: 8px; }
header button { border: 0; color: #fff; background: transparent; font-size: 24px; line-height: 1; cursor: pointer; }
.conversation-bar { display: flex; min-height: 39px; padding: 7px 12px; align-items: center; gap: 6px; border-bottom: 1px solid #e3e9e5; background: #fff; }
.conversation-bar select { min-width: 0; flex: 1; padding: 5px 7px; border: 1px solid #ccd9d0; border-radius: 8px; color: #34463c; background: #fff; }
.conversation-bar button { padding: 5px 8px; border: 1px solid #b8d0c1; border-radius: 8px; color: #35664e; background: #fff; cursor: pointer; }
.conversation-bar button:disabled { opacity: .5; cursor: not-allowed; }
.conversation-bar small { margin: auto; color: #8a958e; font-size: 11px; }
.message-list { position: relative; display: flex; overflow: auto; padding: 16px; flex-direction: column; gap: 12px; }
.history-status { position: absolute; top: 8px; left: 50%; z-index: 1; padding: 4px 8px; transform: translateX(-50%); border-radius: 10px; color: #718078; background: rgba(248, 250, 248, .94); font-size: 11px; white-space: nowrap; }
.message-list article { max-width: 88%; }
.message-list article p { margin: 0; padding: 10px 12px; border-radius: 14px; color: #34463c; background: #fff; box-shadow: 0 2px 9px rgba(41, 66, 52, .07); font-size: 14px; line-height: 1.6; white-space: pre-wrap; }
.message-list .user { align-self: flex-end; }
.message-list .user p { color: #fff; background: #377457; border-bottom-right-radius: 4px; }
.message-list .assistant p { border-bottom-left-radius: 4px; }
.message-list .failed p { color: #a44436; background: #fff0ed; }
.product-list { display: grid; margin-top: 7px; gap: 7px; }
.product-list a { display: grid; padding: 7px; grid-template-columns: 48px 1fr; gap: 9px; border: 1px solid #e1e8e3; border-radius: 11px; background: #fff; text-decoration: none; }
.product-list img { width: 48px; height: 48px; border-radius: 8px; object-fit: cover; background: #eef1ee; }
.product-list span { display: grid; min-width: 0; align-content: center; gap: 4px; }
.product-list b { overflow: hidden; color: #2d4035; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.product-list small { color: #d05c42; font-size: 11px; }
.action-card { display: grid; margin-top: 8px; padding: 11px; gap: 7px; border: 1px solid #b9d2c2; border-radius: 12px; background: #fff; }
.action-card strong { color: #294d3b; font-size: 13px; }
.action-card span { color: #6f7d75; font-size: 12px; }
.action-card button { justify-self: start; padding: 7px 11px; border: 0; border-radius: 8px; color: #fff; background: #2d6a4f; cursor: pointer; }
.action-card button:disabled { opacity: .55; }
.action-result { display: block; margin-top: 7px; color: #2d6a4f; font-size: 12px; font-weight: 700; }
.feedback { display: flex; margin-top: 6px; align-items: center; gap: 5px; color: #8a958e; font-size: 10px; }
.feedback button { padding: 2px 4px; border: 0; background: transparent; cursor: pointer; }
.quick-prompts { display: flex; flex-wrap: wrap; gap: 7px; }
.quick-prompts button { padding: 7px 10px; border: 1px solid #b8d0c1; border-radius: 16px; color: #35664e; background: #fff; font-size: 12px; cursor: pointer; }
form { display: grid; padding: 11px 12px 8px; grid-template-columns: 1fr auto; align-items: end; gap: 8px; border-top: 1px solid #e3e9e5; background: #fff; }
textarea { width: 100%; max-height: 90px; padding: 9px 10px; resize: none; border: 1px solid #cddbd1; border-radius: 10px; outline: none; font: inherit; font-size: 13px; line-height: 1.45; }
textarea:focus { border-color: #639078; }
form button { height: 38px; padding: 0 14px; border: 0; border-radius: 9px; color: #fff; background: #2d6a4f; cursor: pointer; }
form button.stop { background: #a75a49; }
form button:disabled { opacity: .5; cursor: not-allowed; }
footer { padding: 0 12px 10px; color: #949d97; background: #fff; font-size: 10px; text-align: center; }
@media (max-width: 560px) { .assistant-trigger { right: 14px; bottom: 16px; } .assistant-panel { inset: 12px 12px 82px; width: auto; height: auto; border-radius: 16px; } }
</style>
