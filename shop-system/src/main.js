import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import { createPinia } from 'pinia'
import './router/permission'
import piniaPluginPersist from 'pinia-plugin-persist'
const pinia = createPinia()
pinia.use(piniaPluginPersist)
createApp(App).use(pinia).use(router).use(ElementPlus).mount('#app')
