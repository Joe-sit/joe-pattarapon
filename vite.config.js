import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import svgLoader from 'vite-svg-loader'
import { PhHorse, PhHeart, PhCube } from "@phosphor-icons/vue";


// https://vitejs.dev/config/
export default defineConfig({
  // base: '/',
  plugins: [vue(), svgLoader()],
})
