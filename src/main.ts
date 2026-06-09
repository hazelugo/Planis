import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'
import { useUIStore } from './stores/ui'
import './style.css'

async function bootstrap() {
  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia)

  const ui = useUIStore()
  ui.initDarkMode()

  const auth = useAuthStore()
  await auth.initialize()

  app.use(router)
  app.mount('#app')
}

bootstrap()
