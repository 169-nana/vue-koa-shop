<template>
   <el-menu class="el-menu-demo" mode="horizontal" :ellipsis="false">
    <router-link :to="{ name: 'index' }" class="navbar">微商城<span>管理后台</span></router-link>
    <!-- 管理员信息 -->
    <el-sub-menu class="menu" index="1">
      <template #title>
        <el-avatar class="avatar" :size="32" :src="avatarURL">{{ admin.username.slice(0, 1) || '管' }}</el-avatar>
        <span class="admin-name">{{ admin.username || '管理员' }}</span>
      </template>
      <router-link :to="{name:'setting'}">
        <el-menu-item index="5">个人中心</el-menu-item>
      </router-link>
      <el-menu-item index="6" @click="onLogout">退出登录</el-menu-item>
    </el-sub-menu>
   </el-menu>
</template>
<script setup lang="ts">
import router from '../router/index'
import useAdmin from '../stores/admin'
import useToken from '../stores/token'
import notification from '../utils/notification'
import { computed, onMounted } from 'vue'
import { getAdmin } from '../api/index'
import { toAssetURL } from '../config'
const { removeToken } = useToken()
const { admin, updateAdmin, removeAdmin } = useAdmin()
const avatarURL = computed(() => toAssetURL(admin.avatar))
onMounted(() => {
  loadAdmin()
})
// 加载管理员信息
const loadAdmin = async () => {
  try {
    const data = await getAdmin()
    updateAdmin({
      username: data.username,
      avatar: data.avatar
    })
  } catch {
    // 请求层已处理提示及登录失效
  }
}
// 退出登录
const onLogout = async () => {
  removeToken()
  removeAdmin()
   router.push({ name: 'login' })
  notification({ message: '已退出登录', type: 'success' })
}
</script>
<style scoped lang="scss">
.el-menu-demo{
  background: #fff;
  border-bottom: 0;
  height: 59px;
  align-items: center;
}
.navbar{
  font-size: 20px;
  font-weight: bold;
  color: #24334b;
  white-space: nowrap;
}
.navbar span { font-size: 12px; font-weight: 400; color: #69788c; margin-left: 14px; padding-left: 14px; border-left: 1px solid #dce3ec; }
.admin-name { font-size: 13px; margin-left: 10px; max-width: 120px; overflow: hidden; text-overflow: ellipsis; }
@media (max-width: 480px) { .navbar span, .admin-name { display: none; } }
.menu{
  font-size: 20px;
  margin-left: auto;
}
</style>
