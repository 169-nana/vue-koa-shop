<template>
  <el-row>
    <el-col :span="24">
      <el-menu active-text-color="#2563b8" class="el-menu-vertical-demo" :default-active="active" text-color="#58687f">
        <!-- 首页 -->
        <router-link :to="{name:'index'}">
          <el-menu-item index="1">
            <el-icon>
              <HomeFilled />
            </el-icon>
            <span>首页</span>
          </el-menu-item>
        </router-link>
        <!-- 商品与分类统一管理 -->
        <router-link :to="{name:'goods'}">
          <el-menu-item index="2">
              <el-icon>
                <ShoppingCartFull />
              </el-icon>
            <span>商品管理</span>
          </el-menu-item>
        </router-link>
        <!-- 个人中心 -->
        <router-link :to="{name: 'setting'}">
        <el-menu-item index="3">
            <el-icon>
              <Setting />
            </el-icon>
            <span>个人中心</span>
          </el-menu-item>
        </router-link>
      </el-menu>
    </el-col>
  </el-row>
</template>
<script setup lang="ts">
import { HomeFilled, Setting, ShoppingCartFull } from '@element-plus/icons-vue'
import { computed } from 'vue'
import router from '../router'
// 菜单索引，根据路由名称获取对应的菜单索引
const menuIndex: Record<string, string> = {
  'index':'1',
  'category':'2',
  'goods':'2',
  'setting':'3'
}
const active=computed(()=>menuIndex[String(router.currentRoute.value.name)] || '1')
</script>
<style scoped lang="scss">
.el-menu {
  padding: 16px 10px;
  height: 100%;
  border:0 !important;
  .is-active{
    background: #edf4ff;
    font-weight: 600;
  }
  a{
    color:inherit;
    text-decoration: none;
  }
}
.el-menu-item { border-radius: 8px; margin-bottom: 8px; }
a:focus-visible { display: block; outline: 2px solid #3675df; border-radius: 8px; }
@media (max-width: 760px) {
  .el-menu-item { padding: 0 !important; justify-content: center; }
  .el-menu-item span { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  .el-menu-item .el-icon { margin-right: 0; }
}
</style>
