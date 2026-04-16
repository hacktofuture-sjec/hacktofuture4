@echo off
title Self-Healing Cloud - Launcher
color 0A
echo ==========================================
echo   Self-Healing Cloud - Starting All Services
echo ==========================================
echo.

echo [1/3] Starting Backend (port 8005)...
start "BACKEND - main.py" cmd /k "cd /d %~dp0backend-agents && .\venv\Scripts\activate && python main.py"

timeout /t 3 /nobreak >nul

echo [2/3] Starting Frontend (port 3000)...
start "FRONTEND - http.server" cmd /k "cd /d %~dp0frontend && python -m http.server 3000"

echo [3/4] Starting Pushgateway port-forward (port 9091)...
start "PUSHGATEWAY - kubectl forward" cmd /k "kubectl port-forward svc/pushgateway 9091:9091 -n monitoring"

timeout /t 2 /nobreak >nul

echo [4/4] Starting Prometheus port-forward (port 9090)...
start "PROMETHEUS - kubectl forward" cmd /k "kubectl port-forward svc/kube-prom-kube-prometheus-prometheus 9090:9090 -n monitoring"

timeout /t 3 /nobreak >nul

echo.
echo ==========================================
echo   All services started!
echo   Open: http://localhost:3000
echo ==========================================
echo.
start "" "http://localhost:3000"
pause
