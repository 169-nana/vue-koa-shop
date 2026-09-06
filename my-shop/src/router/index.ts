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