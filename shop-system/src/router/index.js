import { createRouter, createWebHistory } from 'vue-router'
import routers from './routers.js'
const router = createRouter({
  history: createWebHistory(),
  routes: routers
})
// 导出路由实例，用于在main.js中使用
export default router
