<template>
  <div class="settings-page">
    <header class="page-heading"><span class="eyebrow">账号设置</span><h1>个人中心</h1><p>管理你的头像与登录密码。</p></header>
    <div class="settings-grid">
      <section class="settings-panel profile-panel">
        <h2>账号资料</h2><p class="section-description">头像将显示在后台导航中</p>
        <div class="profile-preview">
          <el-avatar :src="avatarURL" :size="96"><el-icon :size="36"><User /></el-icon></el-avatar>
          <strong>{{ admin.username || '管理员' }}</strong><span class="role-label">管理员账号</span>
        </div>
        <dl class="account-detail"><dt>登录账号</dt><dd>{{ admin.username || '加载中…' }}</dd></dl>
        <div class="avatar-editor">
          <input ref="fileInput" class="file-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" tabindex="-1" aria-label="选择头像文件" :disabled="busy" @change="selectAvatar" />
          <el-button :icon="Picture" :disabled="busy" @click="fileInput?.click()">{{ selectedFile ? '重新选择' : '更换头像' }}</el-button>
          <p class="upload-help">支持 JPG、PNG、WebP、GIF<br />不超过 500KB，建议使用方形图片</p>
          <div v-if="selectedFile" class="pending-avatar">
            <p class="file-name">{{ selectedFile.name }}</p><span>预览尚未保存</span>
            <div class="avatar-actions"><el-button type="primary" :loading="uploading" :disabled="savingPassword" @click="saveAvatar">保存头像</el-button><el-button :disabled="busy" @click="cancelAvatar">取消更换</el-button></div>
          </div>
          <p v-if="avatarMessage" class="feedback" :class="{ error: avatarFailed }" role="status">{{ avatarMessage }}</p>
        </div>
      </section>
      <section class="settings-panel security-panel">
        <div class="security-heading"><el-icon><Lock /></el-icon><div><h2>账号安全</h2><p class="section-description">验证当前密码后设置新的登录密码</p></div></div>
        <div class="security-notice"><el-icon><InfoFilled /></el-icon><span>修改成功后将退出当前登录，请使用新密码重新登录。</span></div>
        <div @submit.prevent="savePassword">
        <el-form ref="formRef" :model="form" :rules="rules" label-position="top" :disabled="busy" class="password-form">
          <el-form-item label="当前密码" prop="currentPassword"><el-input v-model="form.currentPassword" type="password" show-password autocomplete="current-password" placeholder="请输入当前登录密码" /></el-form-item>
          <el-form-item label="新密码" prop="password"><el-input v-model="form.password" type="password" show-password autocomplete="new-password" placeholder="设置 6–12 个字符的新密码" /></el-form-item>
          <p class="password-help">新密码需为 6–12 个字符，且不能与当前密码相同。</p>
          <el-form-item label="确认新密码" prop="confirmation"><el-input v-model="form.confirmation" type="password" show-password autocomplete="new-password" placeholder="请再次输入新密码" /></el-form-item>
          <p v-if="passwordError" class="feedback error" role="alert">{{ passwordError }}</p>
          <div class="form-actions"><el-button type="primary" native-type="submit" :loading="savingPassword">修改密码</el-button><el-button :disabled="busy" @click="resetPassword">清空输入</el-button></div>
        </el-form>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, reactive, ref, watch } from 'vue'
import type { FormInstance, FormRules, FormItemRule } from 'element-plus'
import { User, Picture, Lock, InfoFilled } from '@element-plus/icons-vue'
import { changeAdminPassword, changeAdminAvatar, uploadAdminAvatar } from '../../api'
import useToken from '../../stores/token'
import useAdmin from '../../stores/admin'
import router from '../../router'
import notification from '../../utils/notification'
import { toAssetURL } from '../../config'
import { validateImage } from '../../utils/upload'

const { admin, removeAdmin, updateAdmin } = useAdmin()
const tokenStore = useToken()
const fileInput = ref<HTMLInputElement>()
const selectedFile = ref<File | null>(null)
const previewURL = ref('')
const uploadedPath = ref('')
const avatarURL = computed(() => previewURL.value || toAssetURL(admin.avatar))
const uploading = ref(false), savingPassword = ref(false)
const busy = computed(() => uploading.value || savingPassword.value)
const avatarMessage = ref(''), avatarFailed = ref(false), passwordError = ref('')
const formRef = ref<FormInstance>()
const form = reactive({ currentPassword: '', password: '', confirmation: '' })
let disposed = false

function clearSelection() {
  if (previewURL.value) URL.revokeObjectURL(previewURL.value)
  previewURL.value = ''
  selectedFile.value = null
  uploadedPath.value = ''
  if (fileInput.value) fileInput.value.value = ''
}
function cancelAvatar() {
  clearSelection()
  avatarMessage.value = ''
}
function selectAvatar(event: Event) {
  if (!(event.target instanceof HTMLInputElement) || busy.value) return
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  if (!validateImage(file)) return
  clearSelection()
  selectedFile.value = file
  previewURL.value = URL.createObjectURL(file)
  avatarMessage.value = ''
}
async function saveAvatar() {
  if (busy.value || !selectedFile.value) return
  uploading.value = true
  avatarMessage.value = ''
  avatarFailed.value = false
  try {
    // 保存失败可重试已上传的文件，避免重复上传。
    if (!uploadedPath.value) {
      const result = await uploadAdminAvatar(selectedFile.value)
      if (disposed) return
      uploadedPath.value = result.savepath
    }
    const result = await changeAdminAvatar({ avatar: uploadedPath.value })
    if (disposed) return
    updateAdmin({ avatar: result.avatar })
    clearSelection()
    avatarMessage.value = '头像已更新'
  } catch (error: unknown) {
    if (disposed) return
    avatarFailed.value = true
    avatarMessage.value = error instanceof Error ? error.message : '头像保存失败，请重试'
  } finally { uploading.value = false }
}
const validateNewPassword: NonNullable<FormItemRule['validator']> = (_rule, value: unknown, callback) => {
  callback(value === form.currentPassword ? new Error('新密码不能与当前密码相同') : undefined)
}
const validateConfirmation: NonNullable<FormItemRule['validator']> = (_rule, value: unknown, callback) => {
  callback(value !== form.password ? new Error('两次输入的新密码不一致') : undefined)
}
const rules: FormRules = {
  currentPassword: [{ required: true, message: '请输入当前密码', trigger: 'blur' }],
  password: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, max: 12, message: '新密码长度必须为 6–12 个字符', trigger: 'blur' },
    { validator: validateNewPassword, trigger: 'blur' }
  ],
  confirmation: [{ required: true, message: '请确认新密码', trigger: 'blur' }, { validator: validateConfirmation, trigger: 'blur' }]
}
watch(() => form.password, () => {
  if (form.confirmation) void formRef.value?.validateField('confirmation').catch(() => {})
})
watch(() => form.currentPassword, () => {
  if (form.password) void formRef.value?.validateField('password').catch(() => {})
})
function resetPassword() {
  formRef.value?.resetFields()
  passwordError.value = ''
}
async function savePassword() {
  if (busy.value || !formRef.value) return
  savingPassword.value = true
  passwordError.value = ''
  try {
    const valid = await formRef.value.validate().catch(() => false)
    if (!valid) return
    await changeAdminPassword({ currentPassword: form.currentPassword, password: form.password })
    resetPassword()
    tokenStore.removeToken()
    removeAdmin()
    await router.replace({ name: 'login' })
    notification({ message: '密码已修改，请使用新密码登录', type: 'success' })
  } catch (error: unknown) {
    passwordError.value = error instanceof Error ? error.message : '密码修改失败，请重试'
  } finally { savingPassword.value = false }
}
onUnmounted(() => { disposed = true; clearSelection() })
</script>

<style scoped lang="scss">
.settings-page { max-width: 1160px; margin: 0 auto; color: #24334b; }
.page-heading { margin-bottom: 26px; }.eyebrow { font-size: 13px; font-weight: 600; letter-spacing: 2px; color: #5275a9; }
h1 { margin: 10px 0; font-size: 26px; }h2 { margin: 0; font-size: 17px; }
.page-heading p, .section-description { margin: 8px 0 0; font-size: 13px; color: #69788c; line-height: 1.7; }
.settings-grid { display: grid; grid-template-columns: minmax(280px, 1fr) minmax(0, 1.7fr); gap: 24px; align-items: start; }
.settings-panel { background: white; border: 1px solid #e4eaf2; border-radius: 12px; padding: 28px; min-width: 0; }
.profile-preview { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 30px 0 24px; }.profile-preview strong { max-width: 100%; overflow-wrap: anywhere; font-size: 19px; }.role-label { color: #5275a9; background: #edf4ff; padding: 4px 10px; border-radius: 5px; font-size: 12px; }
.account-detail { display: flex; gap: 16px; justify-content: space-between; padding: 18px 0; margin: 0 0 22px; border-top: 1px solid #eff2f6; border-bottom: 1px solid #eff2f6; font-size: 13px; }.account-detail dt { color: #69788c; flex-shrink: 0; }.account-detail dd { margin: 0; overflow-wrap: anywhere; }
.avatar-editor { text-align: center; }.file-input { display: none; }.upload-help, .password-help { color: #69788c; font-size: 12px; line-height: 1.8; }.pending-avatar { padding: 16px 10px; background: #f5f8fd; border-radius: 8px; }.file-name { margin: 0 0 5px; overflow-wrap: anywhere; font-size: 13px; }.pending-avatar > span { color: #69788c; font-size: 12px; }.avatar-actions { display: flex; justify-content: center; flex-wrap: wrap; gap: 10px; margin-top: 16px; }.avatar-actions .el-button { margin: 0; }
.security-heading { display: flex; gap: 14px; align-items: center; }.security-heading > .el-icon { color: #3675df; background: #edf4ff; padding: 12px; border-radius: 10px; font-size: 22px; }
.security-notice { display: flex; gap: 10px; align-items: flex-start; padding: 14px; margin: 24px 0; color: #52719b; background: #f1f6fd; border-radius: 8px; font-size: 13px; line-height: 1.7; }.security-notice .el-icon { flex-shrink: 0; margin-top: 4px; }
.password-form { max-width: 460px; }.password-form :deep(.el-input__wrapper) { min-height: 36px; }.password-form :deep(.el-form-item) { margin-bottom: 24px; }.password-help { margin-top: -10px; margin-bottom: 20px; }.form-actions { display: flex; gap: 12px; padding-top: 8px; }.form-actions .el-button { margin: 0; }.feedback { font-size: 13px; color: #28764a; line-height: 1.7; overflow-wrap: anywhere; }.feedback.error { color: #c23c3c; }
@media (max-width: 1000px) { .settings-grid { grid-template-columns: 1fr; }.password-form { max-width: none; } }
@media (max-width: 600px) { .settings-panel { padding: 20px; }.settings-grid { gap: 16px; }h1 { font-size: 22px; } }
</style>
