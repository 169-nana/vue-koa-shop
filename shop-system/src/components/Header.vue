<template>
  <div></div>
   <el-menu class="el-menu-demo" mode="horizontal" :ellipsis="false">
    <div class="navbar">"微商城"后台管理系统</div>
    <!-- 管理员信息 -->
    <el-sub-menu class="menu" index="1">
      <template #title>
        <el-avatar class="avatar" :src="admin.avatar">{{ admin.username }}</el-avatar>
      </template>
      <router-link :to="{name:'setting'}">
        <el-menu-item index="5">个人中心</el-menu-item>
      </router-link>
      <el-menu-item index="6" @click="onLogout">退出登录</el-menu-item>
    </el-sub-menu>
   </el-menu>
</template>
<script setup>
import router from '../router/index'
import useAdmin from '../stores/admin'
import useToken from '../stores/token'
import notification from '../utils/notification'
import { onMounted } from 'vue'
import { getAdmin } from '../api/index'
const { removeToken } = useToken()
const { admin, updateAdmin, removeAdmin } = useAdmin()
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
  background: linear-gradient(90deg,#409EFF,#9ec8ff);
}
.navbar{
  font-size: 20px;
  font-weight: bold;
  color: rgb(255, 255, 255);
}
.menu{
  font-size: 20px;
  margin-left: auto;
}
</style>
