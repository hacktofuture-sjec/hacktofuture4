import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const hackathonSyncPlugin = () => {
  let attackTriggered = false;
  let defenseStatus = 'idle'; // idle | pending | killed

  return {
    name: 'hackathon-sync',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // Parse JSON body for POST
        const parseBody = () => new Promise(resolve => {
          let body = '';
          req.on('data', chunk => body += chunk.toString());
          req.on('end', () => resolve(body ? JSON.parse(body) : {}));
        });

        if (req.url === '/aegis-sync/state' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ triggered: attackTriggered, defenseStatus }));
          return;
        }
        if (req.url === '/aegis-sync/attack' && req.method === 'POST') {
          attackTriggered = true;
          defenseStatus = 'pending';
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true }));
          return;
        }
        if (req.url === '/aegis-sync/defend' && req.method === 'POST') {
          const body = await parseBody();
          defenseStatus = body.status || 'killed';
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true }));
          return;
        }
        if (req.url === '/aegis-sync/reset' && req.method === 'POST') {
          attackTriggered = false;
          defenseStatus = 'idle';
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
