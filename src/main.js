import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'
import { inject } from "@vercel/analytics"
import { MotionPlugin } from '@vueuse/motion'

inject();

// createApp(App).mount('#app').
const app = createApp(App)
app.use(router)
app.use(MotionPlugin)

app.mount('#app')