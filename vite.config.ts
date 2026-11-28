import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import svgr from 'vite-plugin-svgr'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), svgr(), basicSsl()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  server: {
    host: 'localhost',
    // จองพอร์ตเดิมไว้ — ถ้า 5173 ถูกใช้อยู่ ให้ขึ้น error แทนที่จะแอบย้ายไป 5174 (URL ที่บุ๊กมาร์กไว้จะได้ไม่เปลี่ยน)
    port: 5173,
    strictPort: true,
  },
})
