<template>
  <div class="password-control"><input :id="id" :value="modelValue" :type="visible ? 'text' : 'password'" :autocomplete="autocomplete" :placeholder="placeholder" :disabled="disabled" :aria-describedby="describedby" @input="onInput" /><button type="button" :disabled="disabled" :aria-controls="id" :aria-pressed="visible" :aria-label="visible ? '隐藏密码' : '显示密码'" @click="visible = !visible">{{ visible ? '隐藏' : '显示' }}</button></div>
</template>
<script setup lang="ts">
import { ref } from 'vue'
defineProps<{ id: string; modelValue: string; autocomplete: string; placeholder: string; disabled: boolean; describedby?: string }>()
const emit = defineEmits<{ (event: 'update:modelValue', value: string): void }>()
const visible = ref(false)
function onInput(event: Event) { if (event.target instanceof HTMLInputElement) emit('update:modelValue', event.target.value) }
</script>
<style scoped>
.password-control { position: relative; }.password-control input { padding-right: 65px; }.password-control button { position: absolute; right: 4px; top: 4px; height: 40px; padding: 0 12px; background: transparent; border: 0; color: #2d6a4f; border-radius: 6px; font-size: 12px; cursor: pointer; }
</style>
