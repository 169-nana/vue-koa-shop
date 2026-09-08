<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import type { AddressInput, UserAddress } from '../../../shared/api'
import { addAddress, getAddresses } from '../api'

const props = defineProps<{ modelValue: number | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

const addresses = ref<UserAddress[]>([])
const loading = ref(true)
const saving = ref(false)
const showForm = ref(false)
const errorMessage = ref('')
const form = reactive<AddressInput>({
  receiver_name: '',
  receiver_phone: '',
  receiver_address: '',
  is_default: false
})

async function loadAddresses(preferredId?: number) {
  loading.value = true
  try {
    addresses.value = await getAddresses()
    const selected = preferredId
      ? addresses.value.find(item => item.id === preferredId)
      : addresses.value.find(item => item.id === props.modelValue)
        ?? addresses.value.find(item => item.is_default)
        ?? addresses.value[0]
    if (selected) emit('update:modelValue', selected.id)
    if (addresses.value.length === 0) showForm.value = true
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : '地址加载失败'
  } finally {
    loading.value = false
  }
}

async function saveAddress() {
  if (saving.value) return
  errorMessage.value = ''
  if (!form.receiver_name.trim() || form.receiver_name.trim().length > 50) { errorMessage.value = '收货人姓名必须是1到50个字符'; return }
  if (!/^1\d{10}$/.test(form.receiver_phone.trim())) { errorMessage.value = '请输入正确的11位手机号码'; return }
  if (form.receiver_address.trim().length < 5) { errorMessage.value = '收货地址至少需要5个字符'; return }
  saving.value = true
  try {
    const result = await addAddress({
      receiver_name: form.receiver_name.trim(),
      receiver_phone: form.receiver_phone.trim(),
      receiver_address: form.receiver_address.trim(),
      is_default: form.is_default
    })
    showForm.value = false
    await loadAddresses(result.insertId)
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : '地址保存失败'
  } finally {
    saving.value = false
  }
}

onMounted(() => loadAddresses())
</script>

<template>
  <div class="address-picker">
    <div class="heading"><strong>收货地址</strong><button type="button" @click="showForm = !showForm">{{ showForm ? '取消新增' : '新增地址' }}</button></div>
    <p v-if="loading">地址加载中……</p>
    <div v-else class="address-list">
      <label v-for="address in addresses" :key="address.id" :class="{ active: modelValue === address.id }">
        <input :checked="modelValue === address.id" type="radio" name="address" @change="emit('update:modelValue', address.id)">
        <span><strong>{{ address.receiver_name }}　{{ address.receiver_phone }}</strong><small>{{ address.receiver_address }}</small></span>
        <em v-if="address.is_default">默认</em>
      </label>
    </div>
    <form v-if="showForm" class="address-form" @submit.prevent="saveAddress">
      <input v-model="form.receiver_name" maxlength="50" placeholder="收货人姓名">
      <input v-model="form.receiver_phone" maxlength="11" inputmode="numeric" placeholder="11位手机号码">
      <textarea v-model="form.receiver_address" maxlength="255" rows="2" placeholder="省、市、区和详细地址" />
      <label class="default"><input v-model="form.is_default" type="checkbox">设为默认地址</label>
      <button type="submit" :disabled="saving">{{ saving ? '保存中……' : '保存并选择' }}</button>
    </form>
    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
    <RouterLink class="manage" to="/addresses">管理全部地址</RouterLink>
  </div>
</template>

<style scoped>
.address-picker { display: grid; gap: 12px; }.heading { display: flex; align-items: center; justify-content: space-between; }.heading button { border: 0; color: #2d6a4f; background: none; cursor: pointer; }.address-list { display: grid; gap: 10px; max-height: 190px; overflow: auto; }.address-list > label { display: flex; gap: 10px; padding: 12px; align-items: flex-start; border: 1px solid #dce3de; border-radius: 10px; cursor: pointer; }.address-list > label.active { border-color: #2d6a4f; background: #f2f8f4; }.address-list span { display: grid; flex: 1; gap: 5px; }.address-list small { color: #7f8b84; line-height: 1.5; }.address-list em { padding: 3px 7px; border-radius: 8px; color: #2d6a4f; background: #dfeee4; font-size: 11px; font-style: normal; }.address-form { display: grid; gap: 9px; padding: 13px; border-radius: 10px; background: #f6f8f6; }.address-form input, .address-form textarea { padding: 9px 11px; border: 1px solid #d3dcd6; border-radius: 8px; font: inherit; resize: vertical; }.address-form .default { display: flex; gap: 7px; align-items: center; font-size: 13px; }.address-form button { padding: 10px; border: 0; border-radius: 8px; color: white; background: #2d6a4f; cursor: pointer; }.error { margin: 0; color: #b54d3a; font-size: 13px; }.manage { color: #2d6a4f; font-size: 13px; }
</style>
