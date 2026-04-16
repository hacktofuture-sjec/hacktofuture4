@echo off
setlocal enabledelayedexpansion
:: ======================================================================
::  HTF 4.0 - Red vs Blue Autonomous Security Simulation
::  Windows automated launcher
:: ======================================================================

set "ROOT_DIR=%~dp0"
cd /d "%ROOT_DIR%"

set "MODE=%~1"
if "%MODE%"=="" set "MODE=all"

if /i "%MODE%"=="-h"     goto :usage
if /i "%MODE%"=="--help"  goto :usage
if /i "%MODE%"=="help"    goto :usage

:: ── Banner ──────────────────────────────────────────────────────────
echo.
echo ================================================================
echo   HTF 4.0 - Red vs Blue Autonomous Security Simulation
echo ================================================================
echo.

:: ── Detect Python ───────────────────────────────────────────────────
set "PYTHON="
where python >nul 2>&1
if %errorlevel%==0 (
    for /f "tokens=*" %%v in ('python --version 2^>^&1') do set "PY_VER=%%v"
    echo !PY_VER! | findstr /c:"Python 3" >nul 2>&1
    if !errorlevel!==0 (
        set "PYTHON=python"
    )
)
if "%PYTHON%"=="" (
    where python3 >nul 2>&1
    if %errorlevel%==0 (
        set "PYTHON=python3"
    )
)
if "%PYTHON%"=="" (
    echo [ERROR] Python 3 not found. Please install Python 3.9+.
    exit /b 1
)
for /f "tokens=*" %%v in ('%PYTHON% --version 2^>^&1') do set "PY_VER=%%v"
echo [INFO]  Python: %PY_VER% (%PYTHON%)

:: ── Detect Node ─────────────────────────────────────────────────────
set "HAS_NODE=0"
where node >nul 2>&1
if %errorlevel%==0 (
    for /f "tokens=*" %%v in ('node --version 2^>^&1') do set "NODE_VER=%%v"
    echo [INFO]  Node.js: !NODE_VER!
    where npm >nul 2>&1
    if !errorlevel!==0 (
        set "HAS_NODE=1"
    ) else (
        echo [WARN]  npm not found. Frontends will not be started.
    )
) else (
    echo [WARN]  Node.js not found. Frontends will not be started.
)
echo.

:: ── Route to mode ───────────────────────────────────────────────────
if /i "%MODE%"=="test"     goto :run_tests
if /i "%MODE%"=="docker"   goto :run_docker

:: ── Setup .env ──────────────────────────────────────────────────────
if not exist "%ROOT_DIR%.env" (
    echo [WARN]  .env not found - creating from .env.example
    copy "%ROOT_DIR%.env.example" "%ROOT_DIR%.env" >nul 2>&1
    echo [INFO]  Created .env (edit it to add API keys if needed^)
) else (
    echo [INFO]  .env file found
)

:: ── Load .env ───────────────────────────────────────────────────────
if exist "%ROOT_DIR%.env" (
    for /f "usebackq tokens=1,* delims==" %%a in ("%ROOT_DIR%.env") do (
        set "line=%%a"
        if not "!line:~0,1!"=="#" (
            if not "%%b"=="" (
                set "%%a=%%b"
            )
        )
    )
    echo [INFO]  Loaded environment from .env
)

:: ── Install Python deps ─────────────────────────────────────────────
echo [INFO]  Installing Python dependencies...
%PYTHON% -m pip install -r "%ROOT_DIR%requirements.txt" --quiet >nul 2>&1
echo [INFO]  Python dependencies ready

:: ── Install frontend deps ───────────────────────────────────────────
if "%HAS_NODE%"=="1" (
    if /i "%MODE%"=="all" (
        call :install_npm "%ROOT_DIR%blue_agent\frontend" "Blue"
        call :install_npm "%ROOT_DIR%red_agent\frontend" "Red"
    )
    if /i "%MODE%"=="blue" (
        call :install_npm "%ROOT_DIR%blue_agent\frontend" "Blue"
    )
    if /i "%MODE%"=="red" (
        call :install_npm "%ROOT_DIR%red_agent\frontend" "Red"
    )
)
echo.

:: ── Free ports ──────────────────────────────────────────────────────
echo [INFO]  Freeing required ports...
if /i "%MODE%"=="all" (
    call :free_port 8001
    call :free_port 8002
    call :free_port 5173
    call :free_port 5174
)
if /i "%MODE%"=="blue" (
    call :free_port 8002
    call :free_port 5174
)
if /i "%MODE%"=="red" (
    call :free_port 8001
    call :free_port 5173
)
if /i "%MODE%"=="backends" (
    call :free_port 8001
    call :free_port 8002
)

:: ── Start services ──────────────────────────────────────────────────
echo [INFO]  Starting services (mode: %MODE%^)...
echo.

if /i "%MODE%"=="all"      goto :start_all
if /i "%MODE%"=="blue"     goto :start_blue
if /i "%MODE%"=="red"      goto :start_red
if /i "%MODE%"=="backends" goto :start_backends

echo [ERROR] Unknown mode: %MODE%
goto :usage

:: ── START ALL ───────────────────────────────────────────────────────
:start_all
start "[RED] Backend :8001" /min cmd /c "set PYTHONPATH=%ROOT_DIR% && %PYTHON% -m uvicorn red_agent.backend.main:app --host 0.0.0.0 --port 8001 --log-level info --reload --reload-dir red_agent --reload-dir core"
echo [RED]   Red backend starting on port 8001
start "[BLUE] Backend :8002" /min cmd /c "set PYTHONPATH=%ROOT_DIR% && %PYTHON% -m uvicorn blue_agent.backend.main:app --host 0.0.0.0 --port 8002 --log-level info --reload --reload-dir blue_agent --reload-dir core"
echo [BLUE]  Blue backend starting on port 8002
if "%HAS_NODE%"=="1" (
    timeout /t 3 /nobreak >nul
    start "[RED] Frontend :5173" /min cmd /c "cd /d %ROOT_DIR%red_agent\frontend && npm run dev -- --port 5173 --strictPort"
    echo [RED]   Red frontend starting on port 5173
    start "[BLUE] Frontend :5174" /min cmd /c "cd /d %ROOT_DIR%blue_agent\frontend && npm run dev -- --port 5174 --strictPort"
    echo [BLUE]  Blue frontend starting on port 5174
)
goto :wait_and_print

:: ── START BLUE ──────────────────────────────────────────────────────
:start_blue
start "[BLUE] Backend :8002" /min cmd /c "set PYTHONPATH=%ROOT_DIR% && %PYTHON% -m uvicorn blue_agent.backend.main:app --host 0.0.0.0 --port 8002 --log-level info --reload --reload-dir blue_agent --reload-dir core"
echo [BLUE]  Blue backend starting on port 8002
if "%HAS_NODE%"=="1" (
    timeout /t 3 /nobreak >nul
    start "[BLUE] Frontend :5174" /min cmd /c "cd /d %ROOT_DIR%blue_agent\frontend && npm run dev -- --port 5174 --strictPort"
    echo [BLUE]  Blue frontend starting on port 5174
)
goto :wait_and_print

:: ── START RED ───────────────────────────────────────────────────────
:start_red
start "[RED] Backend :8001" /min cmd /c "set PYTHONPATH=%ROOT_DIR% && %PYTHON% -m uvicorn red_agent.backend.main:app --host 0.0.0.0 --port 8001 --log-level info --reload --reload-dir red_agent --reload-dir core"
echo [RED]   Red backend starting on port 8001
if "%HAS_NODE%"=="1" (
    timeout /t 3 /nobreak >nul
    start "[RED] Frontend :5173" /min cmd /c "cd /d %ROOT_DIR%red_agent\frontend && npm run dev -- --port 5173 --strictPort"
    echo [RED]   Red frontend starting on port 5173
)
goto :wait_and_print

:: ── START BACKENDS ──────────────────────────────────────────────────
:start_backends
start "[RED] Backend :8001" /min cmd /c "set PYTHONPATH=%ROOT_DIR% && %PYTHON% -m uvicorn red_agent.backend.main:app --host 0.0.0.0 --port 8001 --log-level info --reload --reload-dir red_agent --reload-dir core"
echo [RED]   Red backend starting on port 8001
start "[BLUE] Backend :8002" /min cmd /c "set PYTHONPATH=%ROOT_DIR% && %PYTHON% -m uvicorn blue_agent.backend.main:app --host 0.0.0.0 --port 8002 --log-level info --reload --reload-dir blue_agent --reload-dir core"
echo [BLUE]  Blue backend starting on port 8002
goto :wait_and_print

:: ── Wait for ports + print URLs ─────────────────────────────────────
:wait_and_print
echo.
echo [INFO]  Waiting for services to start...
timeout /t 5 /nobreak >nul

:: Check health endpoints
%PYTHON% -c "import urllib.request; urllib.request.urlopen('http://localhost:8002/health', timeout=5)" >nul 2>&1
if %errorlevel%==0 (
    echo [INFO]  Blue backend is ready on port 8002
) else (
    echo [WARN]  Blue backend not responding yet (may still be starting^)
)
%PYTHON% -c "import urllib.request; urllib.request.urlopen('http://localhost:8001/health', timeout=5)" >nul 2>&1
if %errorlevel%==0 (
    echo [INFO]  Red backend is ready on port 8001
) else (
    echo [WARN]  Red backend not responding yet (may still be starting^)
)

echo.
echo ================================================================
echo   Services Running:
echo ================================================================
echo.
echo   Red Agent
echo     Backend API:  http://localhost:8001
echo     Health check: http://localhost:8001/health
echo     WebSocket:    ws://localhost:8001/ws/red
if "%HAS_NODE%"=="1" echo     Dashboard:    http://localhost:5173
echo.
echo   Blue Agent
echo     Backend API:  http://localhost:8002
echo     Health check: http://localhost:8002/health
echo     WebSocket:    ws://localhost:8002/ws/blue
echo     API Docs:     http://localhost:8002/docs
if "%HAS_NODE%"=="1" echo     Dashboard:    http://localhost:5174
echo.
echo   Blue API Routes:
echo     /defend/*       Defense actions
echo     /patch/*        Patch management
echo     /scan/*         Asset inventory, vulnerabilities, SSH scan
echo     /environment/*  Cloud/OnPrem/Hybrid monitoring
echo     /strategy/*     Defense plans, evolution, status
echo.
echo ================================================================
echo   Press Ctrl+C to stop all services
echo   (Close this window to stop everything^)
echo ================================================================
echo.
echo Tailing Blue backend... (services run in background windows^)
echo.

:: Keep this window alive — closing it signals the user is done
cmd /k "echo Services are running. Type 'exit' or close window to stop."
goto :cleanup

:: ── Cleanup ─────────────────────────────────────────────────────────
:cleanup
echo.
echo [INFO]  Shutting down all services...
taskkill /fi "WINDOWTITLE eq [RED]*" /f >nul 2>&1
taskkill /fi "WINDOWTITLE eq [BLUE]*" /f >nul 2>&1
echo [INFO]  All services stopped.
exit /b 0

:: ── Tests ───────────────────────────────────────────────────────────
:run_tests
echo [INFO]  Running Blue Agent test suite...
echo.
set "PYTHONPATH=%ROOT_DIR%"
%PYTHON% tests\test_blue\test_detection.py
echo.
%PYTHON% tests\test_blue\test_response.py
echo.
%PYTHON% tests\test_blue\test_patching.py
echo.
echo [INFO]  All tests complete.
exit /b 0

:: ── Docker ──────────────────────────────────────────────────────────
:run_docker
where docker >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker not found. Please install Docker Desktop.
    exit /b 1
)
if not exist "%ROOT_DIR%.env" (
    copy "%ROOT_DIR%.env.example" "%ROOT_DIR%.env" >nul 2>&1
)
echo [INFO]  Starting all services via Docker Compose...
docker compose up --build
exit /b 0

:: ── Usage ───────────────────────────────────────────────────────────
:usage
echo Usage: run.bat [mode]
echo.
echo Modes:
echo   all       Start all services (default^)
echo   blue      Start Blue Agent only (backend + frontend^)
echo   red       Start Red Agent only (backend + frontend^)
echo   backends  Start both backends only (no frontends^)
echo   docker    Start everything via Docker Compose
echo   test      Run all Blue Agent tests
echo.
exit /b 0

:: ── Helper: install npm deps ────────────────────────────────────────
:install_npm
set "FDIR=%~1"
set "FNAME=%~2"
if exist "%FDIR%\package.json" (
    if not exist "%FDIR%\node_modules" (
        echo [INFO]  Installing %FNAME% frontend dependencies...
        pushd "%FDIR%"
        call npm install --silent >nul 2>&1
        popd
    ) else (
        echo [INFO]  %FNAME% frontend dependencies already installed
    )
)
exit /b 0

:: ── Helper: free port ───────────────────────────────────────────────
:free_port
set "FPORT=%~1"
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%FPORT% " ^| findstr "LISTENING" 2^>nul') do (
    if not "%%p"=="0" (
        echo [WARN]  Port %FPORT% in use (PID %%p^) - killing
        taskkill /pid %%p /f >nul 2>&1
    )
)
exit /b 0
