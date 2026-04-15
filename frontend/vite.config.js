import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api/auth': {
        target: 'http://auth-service:3001',
        changeOrigin: true
      },
      '/api/messaging': {
        target: 'http://messaging-service:3002',
        changeOrigin: true
      },
      '/api/presence': {
        target: 'http://presence-service:3003',
        changeOrigin: true
      },
      '/api/agent': {
        target: 'http://agent-service:4000',
        changeOrigin: true
      },
      '/socket.io/messaging': {
        target: 'http://messaging-service:3002',
        ws: true,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/socket\.io\/messaging/, '/socket.io')
      },
      '/socket.io/presence': {
        target: 'http://presence-service:3003',
        ws: true,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/socket\.io\/presence/, '/socket.io')
      }
    }
  }
})