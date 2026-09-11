<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import type {
  Goods,
  ShopAgentMessage,
  ShopAgentPendingAction
} from '../../../shared/api'

import {
  confirmAgentAddToCart,
  streamWithShopAgent,
  trackAgentProductClick
} from '../api'
import { toAssetURL } from '../config'
import useTokenStore from '../stores/token'

interface DisplayMessage extends ShopAgentMessage {
  products?: Goods[]
  failed?: boolean
  pendingAction?: ShopAgentPendingAction
  actionResult?: string
}

const WELCOME: DisplayMessage = {
  role: 'assistant',
  content: '你好，我可以帮你挑选商品、查询库存，也可以在登录后查询你的订单。'
}
const STORAGE_PREFIX = 'shop_agent_messages_v1:'
const QUICK_PROMPTS = ['推荐一些热卖商品', '对比刚才推荐的商品', '查看我的购物车', '配送和运费怎么算？']

const tokenStore = useTokenStore()
const opened = ref(false)
const input = ref('')
const loading = ref(false)
const confirmingToken = ref('')
const messageList = ref<HTMLElement | null>(null)
const messages = ref<DisplayMessage[]>([])
let activeRequest: AbortController | null = null

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
  const saved = localStorage.getItem(storageKey())
  if (!saved) {
    messages.value = [{ ...WELCOME }]
    return
  }

  try {
    const parsed: unknown = JSON.parse(saved)
    messages.value = Array.isArray(parsed) && parsed.length > 0
      ? parsed.filter((item): item is DisplayMessage =>
          typeof item === 'object' &&
          item !== null &&
          'role' in item &&
          (item.role === 'user' || item.role === 'assistant') &&
          'content' in item &&
          typeof item.content === 'string'
        ).slice(-30)
      : [{ ...WELCOME }]
  } catch {
    messages.value = [{ ...WELCOME }]
  }
}

function saveMessages(): void {
  const completed = messages.value
    .filter(message => message.content && !message.failed)
    .map(({ role, content, products, failed }) => ({ role, content, products, failed }))
    .slice(-30)
  localStorage.setItem(storageKey(), JSON.stringify(completed))
}

loadMessages()
watch(messages, saveMessages, { deep: true })
watch(() => tokenStore.token, () => {
  stopGenerating()
  loadMessages()
})

const canSend = computed(() => input.value.trim().length > 0 && !loading.value)

async function scrollToBottom(): Promise<void> {
  await nextTick()
  if (messageList.value) messageList.value.scrollTop = messageList.value.scrollHeight
}

async function sendMessage(preset?: string): Promise<void> {
  const content = (preset ?? input.value).trim()
  if (!content || loading.value) return

  messages.value.push({ role: 'user', content })
  input.value = ''
  loading.value = true
  const assistantMessage: DisplayMessage = { role: 'assistant', content: '' }
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
      { messages: history },
      tokenStore.token,
      {
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
        }
      },
      activeRequest.signal
    )

    if (!assistantMessage.content) assistantMessage.content = '暂时没有找到合适的回答。'
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
    await scrollToBottom()
  }
}

async function confirmAction(message: DisplayMessage): Promise<void> {
  const action = message.pendingAction
  if (!action || confirmingToken.value) return
  confirmingToken.value = action.token
  try {
    const result = await confirmAgentAddToCart({ token: action.token })
    message.actionResult = result.message
    message.pendingAction = undefined
  } catch (error: unknown) {
    message.actionResult = error instanceof Error ? error.message : '加购失败，请重新发起'
    message.pendingAction = undefined
  } finally {
    confirmingToken.value = ''
  }
}

function stopGenerating(): void {
  activeRequest?.abort()
}

function clearConversation(): void {
  if (loading.value) stopGenerating()
  messages.value = [{ ...WELCOME }]
  localStorage.removeItem(storageKey())
}

function handleProductClick(goodsId: number): void {
  opened.value = false
  void trackAgentProductClick(goodsId, Boolean(tokenStore.token)).catch(() => undefined)
}
</script>

<template>
  <button
    class="assistant-trigger"
    type="button"
    :aria-expanded="opened"
    aria-label="打开智能导购"
    @click="opened = !opened"
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
        <button type="button" aria-label="清空对话" title="清空对话" @click="clearConversation">↻</button>
        <button type="button" aria-label="关闭" @click="opened = false">×</button>
      </nav>
    </header>

    <div ref="messageList" class="message-list" aria-live="polite">
      <article
        v-for="(message, index) in messages"
        :key="index"
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
            :disabled="Boolean(confirmingToken)"
            @click="confirmAction(message)"
          >
            {{ confirmingToken === message.pendingAction.token ? '处理中…' : '确认加入购物车' }}
          </button>
        </section>
        <RouterLink v-if="message.actionResult" class="action-result" to="/cart" @click="opened = false">
          {{ message.actionResult }}，查看购物车 →
        </RouterLink>
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
.assistant-panel { position: fixed; right: 24px; bottom: 92px; z-index: 80; display: grid; width: min(390px, calc(100vw - 24px)); height: min(620px, calc(100vh - 120px)); grid-template-rows: auto 1fr auto auto; overflow: hidden; border: 1px solid #dce7df; border-radius: 20px; background: #f8faf8; box-shadow: 0 22px 60px rgba(28, 54, 40, .22); }
header { display: flex; padding: 17px 18px; align-items: center; justify-content: space-between; color: white; background: #2d6a4f; }
header div { display: grid; gap: 3px; }
header strong { font-size: 17px; }
header small { color: #dcebe2; font-size: 11px; }
header nav { display: flex; gap: 8px; }
header button { border: 0; color: #fff; background: transparent; font-size: 24px; line-height: 1; cursor: pointer; }
.message-list { display: flex; overflow: auto; padding: 16px; flex-direction: column; gap: 12px; }
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
