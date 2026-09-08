<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { AdminAccount, AdminRole } from '../../../../shared/api'
import { createAdminAccount, getAdminAccounts, updateAdminAccount } from '../../api'
import useAdmin from '../../stores/admin'

const list = ref<AdminAccount[]>([]), loading = ref(false), dialogVisible = ref(false), submitting = ref(false)
const form = reactive<{ username: string; password: string; role: AdminRole }>({ username: '', password: '', role: 'reviewer' })
const current = useAdmin()
async function load() { loading.value = true; try { list.value = await getAdminAccounts() } finally { loading.value = false } }
function openCreate() { Object.assign(form, { username: '', password: '', role: 'reviewer' as AdminRole }); dialogVisible.value = true }
async function create() {
  if (!form.username || !form.password) { ElMessage.warning('请填写用户名和初始密码'); return }
  submitting.value = true
  try { await createAdminAccount({ ...form }); dialogVisible.value = false; ElMessage.success('后台账号已创建'); await load() }
  finally { submitting.value = false }
}
async function update(item: AdminAccount) {
  try { await updateAdminAccount({ id: item.id, role: item.role, status: item.status }); ElMessage.success('账号状态已保存') }
  catch { await load() }
}
onMounted(load)
</script>
<template>
  <div><div class="heading"><div><h2>后台账号管理</h2><p>创建审核人员，并管理后台账号的角色和启用状态</p></div><el-button type="primary" @click="openCreate">新增账号</el-button></div>
    <el-table v-loading="loading" :data="list" border stripe><el-table-column prop="id" label="ID" width="80"/><el-table-column prop="username" label="用户名" min-width="180"/><el-table-column label="角色" width="180"><template #default="scope"><el-select v-model="scope.row.role" :disabled="scope.row.username === current.admin.username"><el-option label="管理员" value="admin"/><el-option label="审核人员" value="reviewer"/></el-select></template></el-table-column><el-table-column label="状态" width="150"><template #default="scope"><el-switch v-model="scope.row.status" :active-value="1" :inactive-value="0" :disabled="scope.row.username === current.admin.username" active-text="启用" inactive-text="停用"/></template></el-table-column><el-table-column label="操作" width="120"><template #default="scope"><el-button link type="primary" :disabled="scope.row.username === current.admin.username" @click="update(scope.row)">保存</el-button></template></el-table-column></el-table>
    <el-dialog v-model="dialogVisible" title="新增后台账号" width="min(460px, 92vw)"><form class="account-form" @submit.prevent="create"><label>用户名<input v-model="form.username" maxlength="20" autocomplete="off"></label><label>初始密码<input v-model="form.password" type="password" maxlength="20" autocomplete="new-password"></label><label>角色<select v-model="form.role"><option value="reviewer">审核人员</option><option value="admin">管理员</option></select></label></form><template #footer><el-button @click="dialogVisible=false">取消</el-button><el-button type="primary" :loading="submitting" @click="create">创建</el-button></template></el-dialog>
  </div>
</template>
<style scoped>.heading{display:flex;align-items:end;justify-content:space-between;margin-bottom:20px}.heading h2{margin:0}.heading p{margin:7px 0 0;color:#909399}.account-form label{display:grid;grid-template-columns:85px 1fr;align-items:center;gap:10px;margin:18px 0}.account-form input,.account-form select{box-sizing:border-box;width:100%;padding:10px 12px;border:1px solid #dcdfe6;border-radius:4px;font:inherit}</style>
