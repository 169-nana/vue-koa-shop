<template>
  <main class="admin-auth">
    <header class="auth-brand"><span class="brand-mark" aria-hidden="true">M</span><strong>微商城</strong><span class="brand-caption">管理后台</span></header>
    <section class="login-card">
      <div class="login-symbol" aria-hidden="true"><el-icon :size="26"><Lock /></el-icon></div>
      <p class="eyebrow">商城管理工作台</p><h1>登录管理后台</h1><p class="intro">欢迎回来，登录后开始管理你的商城。</p>
      <form :aria-busy="loading" @submit.prevent="submit">
        <div class="field"><label for="admin-username">用户名</label><div class="input-control"><el-icon><User /></el-icon><input id="admin-username" v-model.trim="form.username" autocomplete="username" name="username" placeholder="请输入管理员用户名" :disabled="loading" aria-describedby="admin-feedback" /></div></div>
        <div class="field"><label for="admin-password">密码</label><div class="input-control"><el-icon><Lock /></el-icon><input id="admin-password" v-model="form.password" :type="showPassword ? 'text' : 'password'" autocomplete="current-password" name="password" placeholder="请输入登录密码" :disabled="loading" aria-describedby="admin-feedback" /><button class="show-password" type="button" :disabled="loading" :aria-pressed="showPassword" aria-controls="admin-password" :aria-label="showPassword ? '隐藏密码' : '显示密码'" @click="showPassword = !showPassword">{{ showPassword ? '隐藏' : '显示' }}</button></div></div>
        <p id="admin-feedback" class="feedback" role="status" aria-live="polite">{{ errorMessage }}</p>
        <button class="login-button" type="submit" :disabled="loading">{{ loading ? '正在登录…' : '登录后台' }}<span v-if="!loading" aria-hidden="true">→</span></button>
      </form>
      <p class="account-note">请使用管理员账号登录</p>
    </section>
    <footer class="auth-footer">微商城 · 后台管理系统</footer>
  </main>
</template>
<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { User, Lock } from '@element-plus/icons-vue'
import { login } from '../api'
import useToken from '../stores/token'
import { getAuthRedirect } from '../../../shared/auth'
const route = useRoute(), router = useRouter(), token = useToken()
const form = reactive({ username: '', password: '' })
const loading = ref(false), showPassword = ref(false), errorMessage = ref('')
async function submit() {
  if (loading.value) return
  errorMessage.value = ''
  if (!form.username || !form.password) {
    errorMessage.value = '请输入用户名和密码'
    document.getElementById(!form.username ? 'admin-username' : 'admin-password')?.focus()
    return
  }
  loading.value = true
  try {
    const data = await login({ username: form.username, password: form.password })
    token.updateToken(data.token)
    const target = getAuthRedirect(route.query.redirect, '/index')
    await router.replace(router.resolve(target).matched.length ? target : '/index')
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : '登录失败，请稍后重试'
  } finally { loading.value = false }
}
</script>
<style scoped>
.admin-auth, .admin-auth * { box-sizing: border-box; }.admin-auth { height: 100%; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; align-items: center; padding: 0 24px; font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif; color: #24334b; background: radial-gradient(ellipse at 10% 10%, #dce9fb 0, transparent 45%), radial-gradient(ellipse at 95% 95%, #e3eafa 0, transparent 50%), #f4f7fc; }.auth-brand { flex-shrink: 0; display: flex; align-items: center; gap: 12px; width: min(1120px, 100%); min-height: 100px; }.brand-mark { width: 34px; height: 34px; display: grid; place-items: center; color: white; font-size: 20px; font-weight: 700; background: #3675df; border-radius: 10px; }.auth-brand strong { font-size: 21px; }.brand-caption { padding-left: 14px; border-left: 1px solid #cad7e7; font-size: 12px; color: #69788c; }
.login-card { flex-shrink: 0; width: min(420px, 100%); margin: auto 0; padding: 36px; border: 1px solid #e3eaf5; border-radius: 20px; background: #fff; box-shadow: 0 20px 60px #2649720d; }.login-symbol { width: 54px; height: 54px; border-radius: 15px; background: #edf4ff; color: #3675df; display: grid; place-items: center; margin-bottom: 24px; }.eyebrow { color: #6b83a6; font-size: 11px; letter-spacing: 2px; margin: 0 0 10px; }h1 { margin: 0 0 10px; font-size: 26px; }.intro { font-size: 13px; color: #69788c; line-height: 1.8; margin: 0 0 30px; }.field { margin-bottom: 20px; }.field label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 9px; }.input-control { position: relative; }.input-control > .el-icon { position: absolute; left: 14px; top: 16px; color: #8393a9; }.input-control input { font: inherit; font-size: 14px; width: 100%; height: 48px; border: 1px solid #dbe3ee; border-radius: 8px; padding: 0 14px 0 40px; color: #24334b; background: #fcfdff; }.input-control input::placeholder { color: #8a98ab; font-size: 13px; }.input-control input:focus { border-color: #3675df; outline: 3px solid #3675df15; }.input-control #admin-password { padding-right: 62px; }.show-password { position: absolute; right: 4px; top: 4px; height: 40px; padding: 0 12px; border: 0; border-radius: 5px; background: transparent; color: #326ec5; font-size: 12px; cursor: pointer; }.feedback { min-height: 38px; margin: 0 0 12px; font-size: 13px; line-height: 1.7; color: #bb3c3c; overflow-wrap: anywhere; }.login-button { font: inherit; font-size: 14px; font-weight: 600; width: 100%; height: 48px; display: flex; align-items: center; justify-content: center; gap: 16px; border: 0; border-radius: 8px; background: #3675df; color: white; cursor: pointer; }.login-button:hover { background: #2863c5; }.admin-auth button:disabled { opacity: .65; cursor: wait; }.admin-auth button:focus-visible { outline: 2px solid #3675df; outline-offset: 4px; }.account-note { text-align: center; font-size: 12px; color: #8491a3; border-top: 1px solid #edf1f6; margin: 26px 0 0; padding-top: 20px; }.auth-footer { flex-shrink: 0; padding: 30px 0; color: #8391a4; font-size: 12px; }
@media (max-width: 480px) { .admin-auth { padding: 0 16px; }.auth-brand { min-height: 80px; }.login-card { padding: 28px 24px; border-radius: 16px; }h1 { font-size: 23px; } }
</style>
