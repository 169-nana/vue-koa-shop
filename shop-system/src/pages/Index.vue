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
          <el-card class="box-card">
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
</script>
<style scoped lang="scss">
.el-container{
  height: 100%;
  .el-header{
   background: -webkit-gradient(linear,left top,right top,from(#409EFF),to(#9ec8ff));
text-align: center;
 line-height: 60px;
 color: #333;
  }
  .el-aside {
 width: 200px;
 height: 100%;
 color: #333;
background: white
 }
 .el-main {
 height: 100vh;
 background-color: #e9eef3;
 color: #333;
 }
}
</style>
