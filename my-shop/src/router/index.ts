import type { RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'

import useTokenStore from '../stores/token'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () =>
      import('../pages/Home.vue')
  },
  {
    path: '/goods/:id',
    name: 'goods-detail',
    component: () =>
      import('../pages/GoodsDetail.vue')
  },
  {
    path: '/category/:id',
    name: 'category-goods',
    component: () => import('../pages/CategoryGoods.vue')
  },
  {
    path: '/cart',
    name: 'cart',
    component: () => import('../pages/Cart.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/checkout',
    name: 'checkout',
    component: () => import('../pages/Checkout.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/orders',
    name: 'orders',
    component: () => import('../pages/Orders.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/orders/:id',
    name: 'order-detail',
    component: () => import('../pages/OrderDetail.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/addresses',
    name: 'addresses',
    component: () => import('../pages/Addresses.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/after-sales',
    name: 'after-sales',
    component: () => import('../pages/AfterSales.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/reviews',
    name: 'reviews',
    component: () => import('../pages/Reviews.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/login',
    name: 'login',
    component: () =>
      import('../pages/Login.vue')
  },
  {
    path: '/register',
    name: 'register',
    component: () =>
      import('../pages/Register.vue')
  },
  {
    path: '/profile',
    name: 'profile',
    component: () =>
      import('../pages/Profile.vue'),
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/merchant-service',
    name: 'merchant-service',
    component: () => import('../pages/MerchantService.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/merchant/apply',
    name: 'merchant-apply',
    component: () => import('../pages/MerchantApply.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/merchant',
    redirect: { name: 'merchant-service' }
  },
  {
    path: '/merchant/:merchantId',
    component: () => import('../components/MerchantWorkspace.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: { name: 'merchant-overview' } },
      { path: 'overview', name: 'merchant-overview', component: () => import('../pages/merchant/MerchantOverview.vue') },
      { path: 'products', name: 'merchant-products', component: () => import('../pages/merchant/MerchantProducts.vue') },
      { path: 'orders', name: 'merchant-orders', component: () => import('../pages/merchant/MerchantOrders.vue') },
      { path: 'products/new', name: 'merchant-product-new', component: () => import('../pages/merchant/MerchantProductEditor.vue') },
      { path: 'products/edit', name: 'merchant-product-edit', component: () => import('../pages/merchant/MerchantProductEditor.vue') },
      { path: 'submissions', name: 'merchant-submissions', component: () => import('../pages/merchant/MerchantSubmissions.vue') },
      { path: 'stores', name: 'merchant-stores', component: () => import('../pages/merchant/MerchantStores.vue') },
      { path: 'messages', name: 'merchant-messages', component: () => import('../pages/merchant/MerchantMessages.vue') }
    ]
  },
  {
    path: '/notifications',
    name: 'notifications',
    component: () => import('../pages/Notifications.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(to => {
  const tokenStore = useTokenStore()

  if (
    to.meta.requiresAuth &&
    !tokenStore.token
  ) {
    return {
      name: 'login',
      query: {
        redirect: to.fullPath
      }
    }
  }

  return true
})

export default router
