import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const hackathonSyncPlugin = () => {
  let attackTriggered = false;
  return {
    name: 'hackathon-sync',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/aegis-sync/state' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ triggered: attackTriggered }));
          return;
        }
        if (req.url === '/aegis-sync/attack' && req.method === 'POST') {
          attackTriggered = true;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true }));
          return;
        }
        if (req.url === '/aegis-sync/reset' && req.method === 'POST') {
          attackTriggered = false;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true }));
          return;
        }
        next();
      });
    }
  };
};

export default defineConfig({
  plugins: [react(), hackathonSyncPlugin()],
  server: {
    host: '0.0.0.0', // Ensure it binds to local wifi IP
    port: 5173,
    proxy: {
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
