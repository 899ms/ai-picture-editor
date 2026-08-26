import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// 前端与后端通过 dev proxy 保持同源，httpOnly Cookie 与 SSE 因此无需任何跨源配置。
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 7301,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://localhost:7302', changeOrigin: true },
      '/events': { target: 'http://localhost:7302', changeOrigin: true },
    },
  },
})
