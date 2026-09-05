<template>
  <el-row>
    <el-col :span="24">
      <el-menu active-text-color="#white" class="el-menu-vertical-demo" :default-active="active" text-color="#333">
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
<script setup>
import {HomeFilled,Setting,ShoppingCartFull} from '@element-plus/icons-vue'
import { computed } from 'vue'
import router from '../router'
// 菜单索引，根据路由名称获取对应的菜单索引
const menuIndex = {
  'index':'1',
  'category':'2',
  'goods':'2',
  'setting':'3'
}
const active=computed(()=>menuIndex[router.currentRoute.value.name ])
</script>
<style scoped lang="scss">
.el-menu {
  height: 100%;
  border:0 !important;
  .is-active{
    background: linear-gradient(90deg, #409EFF, #9ec8ff);
  }
  a{
    color:white;
    text-decoration: none;
  }
}
</style>
