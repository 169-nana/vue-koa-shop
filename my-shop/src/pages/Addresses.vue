<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import type { AddressInput, UserAddress } from '../../../shared/api'
import { addAddress, getAddresses, removeAddress, setDefaultAddress } from '../api'

const addresses = ref<UserAddress[]>([])
const loading = ref(true)
const saving = ref(false)
const errorMessage = ref('')
const form = reactive<AddressInput>({ receiver_name: '', receiver_phone: '', receiver_address: '', is_default: false })

async function load() {
  loading.value = true
  try { addresses.value = await getAddresses() }
  catch (error: unknown) { errorMessage.value = error instanceof Error ? error.message : '地址加载失败' }
  finally { loading.value = false }
}

async function add() {
  errorMessage.value = ''
  if (!form.receiver_name.trim()) { errorMessage.value = '请输入收货人姓名'; return }
  if (!/^1\d{10}$/.test(form.receiver_phone.trim())) { errorMessage.value = '请输入正确的11位手机号码'; return }
  if (form.receiver_address.trim().length < 5) { errorMessage.value = '请输入完整收货地址'; return }
  saving.value = true
  try {
    await addAddress({ receiver_name: form.receiver_name.trim(), receiver_phone: form.receiver_phone.trim(), receiver_address: form.receiver_address.trim(), is_default: form.is_default })
    Object.assign(form, { receiver_name: '', receiver_phone: '', receiver_address: '', is_default: false })
    await load()
  } catch (error: unknown) { errorMessage.value = error instanceof Error ? error.message : '地址保存失败' }
  finally { saving.value = false }
}

async function makeDefault(id: number) {
  try { await setDefaultAddress(id); await load() }
  catch (error: unknown) { errorMessage.value = error instanceof Error ? error.message : '设置失败' }
}

async function remove(id: number) {
  if (!window.confirm('确定删除这个收货地址吗？')) return
  try { await removeAddress(id); await load() }
  catch (error: unknown) { errorMessage.value = error instanceof Error ? error.message : '删除失败' }
}

onMounted(load)
</script>

<template>
  <main class="page-shell">
    <header><RouterLink class="brand" to="/">微商城</RouterLink><nav><RouterLink to="/profile">个人中心</RouterLink><RouterLink to="/cart">购物车</RouterLink></nav></header>
    <h1>收货地址</h1>
    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
    <section class="card"><h2>新增地址</h2><form @submit.prevent="add"><input v-model="form.receiver_name" maxlength="50" placeholder="收货人姓名"><input v-model="form.receiver_phone" maxlength="11" inputmode="numeric" placeholder="11位手机号码"><textarea v-model="form.receiver_address" maxlength="255" rows="3" placeholder="省、市、区和详细地址" /><label><input v-model="form.is_default" type="checkbox">设为默认地址</label><button :disabled="saving">{{ saving ? '保存中……' : '保存地址' }}</button></form></section>
    <section class="card"><h2>已保存地址</h2><p v-if="loading">加载中……</p><p v-else-if="addresses.length === 0">还没有保存地址</p><article v-for="address in addresses" v-else :key="address.id"><div><strong>{{ address.receiver_name }}　{{ address.receiver_phone }}</strong><p>{{ address.receiver_address }}</p></div><em v-if="address.is_default">默认地址</em><button v-else @click="makeDefault(address.id)">设为默认</button><button class="remove" @click="remove(address.id)">删除</button></article></section>
  </main>
</template>

<style scoped>
.page-shell { width: min(850px, calc(100% - 40px)); margin: 0 auto 50px; color: #26352d; }header { display: flex; min-height: 88px; align-items: center; justify-content: space-between; }.brand { color: #2d6a4f; font: 700 23px Georgia, "Microsoft YaHei", serif; }nav { display: flex; gap: 20px; color: #68766e; }h1 { margin: 25px 0; font: 700 38px Georgia, "Microsoft YaHei", serif; }.card { margin-bottom: 20px; padding: 26px; border-radius: 18px; background: white; }.card h2 { margin-top: 0; }form { display: grid; gap: 12px; }form > input, textarea { padding: 11px 13px; border: 1px solid #d4ddd7; border-radius: 9px; font: inherit; resize: vertical; }form button { padding: 11px; border: 0; border-radius: 9px; color: white; background: #2d6a4f; cursor: pointer; }article { display: flex; gap: 15px; padding: 17px 0; align-items: center; border-top: 1px solid #edf0ee; }article div { flex: 1; }article p { margin: 7px 0 0; color: #7f8b84; }article em { color: #2d6a4f; font-style: normal; }article button { border: 0; color: #2d6a4f; background: none; cursor: pointer; }.remove { color: #aa5342; }.error { padding: 12px; color: #b54d3a; background: #fff0eb; }
</style>
