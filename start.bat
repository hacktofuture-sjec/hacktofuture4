@echo off
setlocal

echo ============================================================
echo  Startup Problem Marketplace
echo ============================================================
echo.

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Install Python 3.11+ from python.org
    pause & exit /b 1
)

:: Check Node
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Install from nodejs.org
    pause & exit /b 1
)

:: Check Ollama
curl -s http://localhost:11434/api/tags >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Ollama not responding on port 11434.
    echo           Make sure Ollama is running: ollama serve
    echo           And the model is pulled:     ollama pull llama3:8b
    echo.
    pause
)

echo [1/4] Installing Python dependencies...
pip install -r requirements.txt -q
if errorlevel 1 (
    echo [ERROR] pip install failed.
    pause & exit /b 1
)
echo       Done.
echo.

echo [2/4] Installing frontend dependencies...
cd frontend
call npm install --silent
if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause & exit /b 1
)
cd ..
echo       Done.
echo.

echo [3/4] Starting FastAPI backend on port 8000...
start "Marketplace Backend" cmd /k "python -m uvicorn backend.main:app --reload --port 8000 --host 0.0.0.0"
timeout /t 3 /nobreak >nul

echo [4/4] Starting React frontend on port 5173...
cd frontend
start "Marketplace Frontend" cmd /k "npm run dev"
cd ..

echo.
echo ============================================================
echo  App is running!
echo.
echo  Open in browser:  http://localhost:5173
echo  API docs:         http://localhost:8000/docs
echo  Backend health:   http://localhost:8000/api/health
echo.
echo  Click "Fetch Latest News" in the app to generate packages.
echo ============================================================
echo.
pause
