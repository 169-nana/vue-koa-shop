import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

const app = createApp(App)
const pinia = createPinia()

// 路由守卫会读取Pinia，因此先注册Pinia
app.use(pinia)
app.use(router)

app.mount('#app')