import Index from '../pages/Index.vue'
const routers = [
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
            component: () => import('../pages/subpages/Category.vue'),
            meta:{
              title:'分类管理'
            }
        },
        {
          path: '/goods',
          name: 'goods',
          component: () => import('../pages/subpages/Goods.vue'),
          meta:{
            title:'商品管理'
          }
        },
        {
          path: '/setting',
          name: 'setting',
          component: () => import('../pages/subpages/Setting.vue'),
          meta:{
            title:'个人中心'
          }
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
