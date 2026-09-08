<template>
  <div class="common-layout">
    <el-container>
      <el-header>
        <Header />
      </el-header>
      <el-container>
        <el-aside>
          <Aside />
        </el-aside>
        <el-main>
          <router-view v-if="route.name === 'index' || route.name === 'setting'" />
          <el-card v-else class="box-card" shadow="never">
            <router-view />
          </el-card>
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>
<script setup lang="ts">
import Header from '../components/Header.vue'
import Aside from '../components/Aside.vue'
import { useRoute } from 'vue-router'
const route = useRoute()
</script>
<style scoped lang="scss">
.common-layout { height: 100%; font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif; }
.el-container{
  height: 100%;
  min-height: 0;
  min-width: 0;
  .el-header{
   background: white;
   border-bottom: 1px solid #e4eaf2;
   flex-shrink: 0;
text-align: center;
 line-height: 60px;
 color: #333;
  }
  .el-aside {
 width: 200px;
 flex-shrink: 0;
 border-right: 1px solid #e4eaf2;
 height: 100%;
 color: #333;
background: white
 }
 .el-main {
 min-width: 0;
 padding: 28px;
 background-color: #f4f7fb;
 color: #333;
 }
}
.box-card { border-radius: 12px; }
@media (max-width: 760px) {
  .el-container .el-aside { width: 76px; }
  .el-container .el-main { padding: 16px; }
  .el-container .el-header { padding: 0 12px; }
}
</style>
