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
