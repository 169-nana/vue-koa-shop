import type { RouteRecordRaw } from 'vue-router'
import Index from '../pages/Index.vue'
const routers: RouteRecordRaw[] = [
    {
      path: '/',
      redirect:'/index',
      component: Index,
      // 路由元信息
      // 用于存储路由相关的元数据，如标题、权限等
      // 可以在路由守卫中使用
      meta:{
        title:'首页',
        requiresAuth: true
      },
      children: [
        {
          path: '/index',
          name: 'index',
          component: () => import('../pages/subpages/Index.vue'),
          meta:{
            title:'首页'
          }
        },
        {
            path: '/category',
            name: 'category',
            redirect: { name: 'goods' }
        },
        {
          path: '/goods',
          name: 'goods',
          component: () => import('../pages/subpages/Goods.vue'),
          meta:{
            title:'商品数据管理',
            adminOnly: true
          }
        },
        {
          path: '/merchant-review',
          name: 'merchant-review',
          component: () => import('../pages/subpages/MerchantReview.vue'),
          meta: { title: '商家入驻审核' }
        },
        {
          path: '/goods-review',
          name: 'goods-review',
          component: () => import('../pages/subpages/GoodsReview.vue'),
          meta: { title: '商品审核' }
        },
        {
          path: '/setting',
          name: 'setting',
          component: () => import('../pages/subpages/Setting.vue'),
          meta:{
            title:'个人中心'
          }
        },
        {
          path: '/accounts',
          name: 'accounts',
          component: () => import('../pages/subpages/Accounts.vue'),
          meta: { title: '后台账号管理', adminOnly: true }
        }
      ]
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../pages/Login.vue'),
      meta:{
        title:'登录'
      }
    }
]
export default routers
