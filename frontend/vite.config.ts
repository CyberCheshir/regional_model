import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Прокси API на Django-backend (backend/docker-compose.yml, порт 8000).
    // Благодаря этому фронтенд обращается к /api без CORS-проблем в dev.
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // vis-network сейчас используется только в Варианте 1 (MAP_ONLY = false).
        // Выносим его (и vis-data) в отдельный чанк — основной бандл меньше,
        // а vis подгружается, только если он реально задействован.
        manualChunks: {
          vis: ['vis-network', 'vis-data'],
        },
      },
    },
  },
})
