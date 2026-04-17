import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Ensure it binds to local wifi IP
    port: 5173,
    proxy: {
      '/auth': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/incidents': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/enforce': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/audit': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/test': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/latest_score': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
      '/analytics': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/analytics/, ''),
      },
    },
  },
})
