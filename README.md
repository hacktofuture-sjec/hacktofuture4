# Nova Chat Monorepo

## Quick start

1. Install dependencies from the repository root:
   ```bash
   npm install
   ```

2. Copy environment variables:
   ```bash
   cp .env.example .env
   ```
   On Windows PowerShell:
   ```powershell
   Copy-Item .env.example .env
   ```

3. Start services in separate terminals as follows:
   - Terminal 1:
     ```bash
     cd auth-service
     npm start
     ```
   - Terminal 2:
     ```bash
     cd messaging-service
     npm start
     ```
   - Terminal 3:
     ```bash
     cd presence-service
     npm start
     ```
   - Terminal 4:
     ```bash
     cd frontend
     npm run dev
     ```

4. Open the frontend in your browser:
   - `http://localhost:5173`

## Available commands

- `npm start` — start local development for all services and frontend in one terminal (optional)
- `npm run build` — build the frontend only
- `npm run gateway` — start the gateway manually if you need it (optional)
- `npm run check-ports` — check whether required ports are available

## Important notes

- When working in separate-terminal mode, the frontend uses Vite dev proxy on `5173` to connect directly to backend services on `3001`, `3002`, and `3003`.
- Do not set `VITE_API_URL` to the gateway address unless you are using the gateway.
- If you see a network error at login, make sure `frontend` is running on port `5173` and the backend services are running on their respective ports.

## Service ports

Default ports configured in `.env`:

- Gateway: `3000`
- Auth Service: `3001`
- Messaging Service: `3002`
- Presence Service: `3003`
- Frontend Vite dev server: `5173`

## Port conflict troubleshooting (Windows)

To see what is using a port:

```powershell
netstat -ano | findstr :3000
netstat -ano | findstr :3003
```

If a process is using a port, kill it by PID:

```powershell
taskkill /PID <PID> /F
```

If you want to clear all default ports quickly:

```powershell
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
```

## Frontend configuration

- Development uses Vite on `5173`
- Vite proxies `/api/auth`, `/api/messaging`, `/api/presence`, and socket paths to the appropriate local backend service ports
- When `VITE_API_URL` is empty, the frontend uses `window.location.origin` so it works when opened on `5173` or through the gateway on `3000`

## Notes

- `npm start` is the recommended command for local development
- `npm run start:prod` is for production-style startup after building the frontend
- Do not bind two services to the same port; use `.env` to override if needed
