import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // While running `npm run dev` locally, requests to /api/... get
    // forwarded to your local Django server instead of hitting Vite's
    // own dev server — means you don't need CORS configured for local
    // dev at all, only for the real deployed frontend URL later.
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})