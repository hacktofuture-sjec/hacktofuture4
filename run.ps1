# ======================================================================
#  HTF 4.0 - Red vs Blue Autonomous Security Simulation
#  Windows PowerShell automated launcher
# ======================================================================

param(
    [ValidateSet("all", "blue", "red", "backends", "docker", "test", "help")]
    [string]$Mode = "all"
)

$ErrorActionPreference = "Stop"
$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RootDir

$Jobs = @()

# ── Colors ───────────────────────────────────────────────────────────
function Log-Info  { param($msg) Write-Host "[INFO]  $msg" -ForegroundColor Green }
function Log-Warn  { param($msg) Write-Host "[WARN]  $msg" -ForegroundColor Yellow }
function Log-Error { param($msg) Write-Host "[ERROR] $msg" -ForegroundColor Red }
function Log-Blue  { param($msg) Write-Host "[BLUE]  $msg" -ForegroundColor Blue }
function Log-Red   { param($msg) Write-Host "[RED]   $msg" -ForegroundColor Red }

# ── Banner ───────────────────────────────────────────────────────────
function Show-Banner {
    Write-Host ""
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host "  HTF 4.0 - Red vs Blue Autonomous Security Simulation" -ForegroundColor Cyan
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host ""
}

# ── Help ─────────────────────────────────────────────────────────────
if ($Mode -eq "help") {
    Write-Host "Usage: .\run.ps1 [-Mode <mode>]"
    Write-Host ""
    Write-Host "Modes:"
    Write-Host "  all       Start all services (default)"
    Write-Host "  blue      Start Blue Agent only (backend + frontend)"
    Write-Host "  red       Start Red Agent only (backend + frontend)"
    Write-Host "  backends  Start both backends only (no frontends)"
    Write-Host "  docker    Start everything via Docker Compose"
    Write-Host "  test      Run all Blue Agent tests"
    exit 0
}

Show-Banner

# ── Detect Python ────────────────────────────────────────────────────
$Python = $null
foreach ($cmd in @("python", "python3", "py")) {
    try {
        $ver = & $cmd --version 2>&1
        if ($ver -match "Python 3") {
            $Python = $cmd
            break
        }
    } catch {}
}
if (-not $Python) {
    Log-Error "Python 3 not found. Please install Python 3.9+."
    exit 1
}
$PyVer = & $Python --version 2>&1
Log-Info "Python: $PyVer ($Python)"

# ── Detect Node ──────────────────────────────────────────────────────
$HasNode = $false
try {
    $NodeVer = & node --version 2>&1
    Log-Info "Node.js: $NodeVer"
    $null = & npm --version 2>&1
    $HasNode = $true
} catch {
    Log-Warn "Node.js/npm not found. Frontends will not be started."
}
Write-Host ""

# ── Tests ────────────────────────────────────────────────────────────
if ($Mode -eq "test") {
    Log-Info "Running Blue Agent test suite..."
    Write-Host ""
    $env:PYTHONPATH = $RootDir
    & $Python tests/test_blue/test_detection.py
    Write-Host ""
    & $Python tests/test_blue/test_response.py
    Write-Host ""
    & $Python tests/test_blue/test_patching.py
    Write-Host ""
    Log-Info "All tests complete."
    exit 0
}

# ── Docker ───────────────────────────────────────────────────────────
if ($Mode -eq "docker") {
    try { $null = & docker --version 2>&1 } catch {
        Log-Error "Docker not found. Please install Docker Desktop."
        exit 1
    }
    if (-not (Test-Path "$RootDir\.env")) {
        Copy-Item "$RootDir\.env.example" "$RootDir\.env"
    }
    Log-Info "Starting all services via Docker Compose..."
    & docker compose up --build
    exit 0
}

# ── Setup .env ───────────────────────────────────────────────────────
if (-not (Test-Path "$RootDir\.env")) {
    Log-Warn ".env not found - creating from .env.example"
    Copy-Item "$RootDir\.env.example" "$RootDir\.env"
    Log-Info "Created .env (edit it to add API keys if needed)"
} else {
    Log-Info ".env file found"
}

# Load .env into current process
if (Test-Path "$RootDir\.env") {
    Get-Content "$RootDir\.env" | ForEach-Object {
        if ($_ -match "^\s*([^#][^=]+)=(.+)$") {
            [Environment]::SetEnvironmentVariable($Matches[1].Trim(), $Matches[2].Trim(), "Process")
        }
    }
    Log-Info "Loaded environment from .env"
}

# ── Install Python deps ──────────────────────────────────────────────
Log-Info "Installing Python dependencies..."
& $Python -m pip install -r "$RootDir\requirements.txt" --quiet 2>$null
Log-Info "Python dependencies ready"

# ── Install frontend deps ────────────────────────────────────────────
function Install-Npm($dir, $name) {
    if ((Test-Path "$dir\package.json") -and -not (Test-Path "$dir\node_modules")) {
        Log-Info "Installing $name frontend dependencies..."
        Push-Location $dir
        & npm install --silent 2>$null
        Pop-Location
    } elseif (Test-Path "$dir\node_modules") {
        Log-Info "$name frontend dependencies already installed"
    }
}

if ($HasNode) {
    if ($Mode -in @("all", "blue")) { Install-Npm "$RootDir\blue_agent\frontend" "Blue" }
    if ($Mode -in @("all", "red"))  { Install-Npm "$RootDir\red_agent\frontend" "Red" }
}
Write-Host ""

# ── Free ports ───────────────────────────────────────────────────────
function Free-Port($port) {
    $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($conn in $connections) {
        $pid = $conn.OwningProcess
        if ($pid -and $pid -ne 0) {
            Log-Warn "Port $port in use (PID $pid) - killing"
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        }
    }
}

Log-Info "Freeing required ports..."
$portsToFree = switch ($Mode) {
    "all"      { @(8001, 8002, 5173, 5174) }
    "blue"     { @(8002, 5174) }
    "red"      { @(8001, 5173) }
    "backends" { @(8001, 8002) }
}
foreach ($p in $portsToFree) { Free-Port $p }

# ── Start services ───────────────────────────────────────────────────
Log-Info "Starting services (mode: $Mode)..."
Write-Host ""

function Start-Backend($name, $module, $port, $color, $reloadDir) {
    $job = Start-Job -Name "$name-backend" -ScriptBlock {
        param($py, $root, $mod, $p, $rd)
        Set-Location $root
        $env:PYTHONPATH = $root
        & $py -m uvicorn "$mod" --host 0.0.0.0 --port $p --log-level info --reload --reload-dir $rd --reload-dir core
    } -ArgumentList $Python, $RootDir, $module, $port, $reloadDir
    Write-Host "[$color]  $name backend starting on port $port (Job $($job.Id))" -ForegroundColor $(if ($color -eq "RED") {"Red"} else {"Blue"})
    return $job
}

function Start-Frontend($name, $dir, $port, $color) {
    $job = Start-Job -Name "$name-frontend" -ScriptBlock {
        param($d, $p)
        Set-Location $d
        & npm run dev -- --port $p --strictPort
    } -ArgumentList $dir, $port
    Write-Host "[$color]  $name frontend starting on port $port (Job $($job.Id))" -ForegroundColor $(if ($color -eq "RED") {"Red"} else {"Blue"})
    return $job
}

switch ($Mode) {
    "all" {
        $Jobs += Start-Backend "Red" "red_agent.backend.main:app" 8001 "RED" "red_agent"
        $Jobs += Start-Backend "Blue" "blue_agent.backend.main:app" 8002 "BLUE" "blue_agent"
        if ($HasNode) {
            Start-Sleep -Seconds 3
            $Jobs += Start-Frontend "Red" "$RootDir\red_agent\frontend" 5173 "RED"
            $Jobs += Start-Frontend "Blue" "$RootDir\blue_agent\frontend" 5174 "BLUE"
        }
    }
    "blue" {
        $Jobs += Start-Backend "Blue" "blue_agent.backend.main:app" 8002 "BLUE" "blue_agent"
        if ($HasNode) {
            Start-Sleep -Seconds 3
            $Jobs += Start-Frontend "Blue" "$RootDir\blue_agent\frontend" 5174 "BLUE"
        }
    }
    "red" {
        $Jobs += Start-Backend "Red" "red_agent.backend.main:app" 8001 "RED" "red_agent"
        if ($HasNode) {
            Start-Sleep -Seconds 3
            $Jobs += Start-Frontend "Red" "$RootDir\red_agent\frontend" 5173 "RED"
        }
    }
    "backends" {
        $Jobs += Start-Backend "Red" "red_agent.backend.main:app" 8001 "RED" "red_agent"
        $Jobs += Start-Backend "Blue" "blue_agent.backend.main:app" 8002 "BLUE" "blue_agent"
    }
}

# ── Wait for services ────────────────────────────────────────────────
Write-Host ""
Log-Info "Waiting for services to start..."
Start-Sleep -Seconds 5

function Test-Port($port) {
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.Connect("localhost", $port)
        $tcp.Close()
        return $true
    } catch { return $false }
}

if ($Mode -in @("all", "backends", "red")) {
    if (Test-Port 8001) { Log-Info "Red backend is ready on port 8001" }
    else { Log-Warn "Red backend not responding yet" }
}
if ($Mode -in @("all", "backends", "blue")) {
    if (Test-Port 8002) { Log-Info "Blue backend is ready on port 8002" }
    else { Log-Warn "Blue backend not responding yet" }
}

# ── Print URLs ───────────────────────────────────────────────────────
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  Services Running:" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Red Agent" -ForegroundColor Red
Write-Host "    Backend API:  http://localhost:8001"
Write-Host "    Health check: http://localhost:8001/health"
Write-Host "    WebSocket:    ws://localhost:8001/ws/red"
if ($HasNode) { Write-Host "    Dashboard:    http://localhost:5173" }
Write-Host ""
Write-Host "  Blue Agent" -ForegroundColor Blue
Write-Host "    Backend API:  http://localhost:8002"
Write-Host "    Health check: http://localhost:8002/health"
Write-Host "    WebSocket:    ws://localhost:8002/ws/blue"
Write-Host "    API Docs:     http://localhost:8002/docs"
if ($HasNode) { Write-Host "    Dashboard:    http://localhost:5174" }
Write-Host ""
Write-Host "  Blue API Routes:" -ForegroundColor Blue
Write-Host "    /defend/*       Defense actions"
Write-Host "    /patch/*        Patch management"
Write-Host "    /scan/*         Asset inventory, vulnerabilities, SSH scan"
Write-Host "    /environment/*  Cloud/OnPrem/Hybrid monitoring"
Write-Host "    /strategy/*     Defense plans, evolution, status"
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  Press Ctrl+C to stop all services" -ForegroundColor Yellow
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# ── Keep alive + cleanup on exit ─────────────────────────────────────
try {
    while ($true) {
        Start-Sleep -Seconds 5
        # Check if any job has failed
        foreach ($job in $Jobs) {
            if ($job.State -eq "Failed") {
                Log-Error "Job $($job.Name) failed:"
                Receive-Job $job
            }
        }
    }
} finally {
    Write-Host ""
    Log-Warn "Shutting down all services..."
    foreach ($job in $Jobs) {
        Stop-Job $job -ErrorAction SilentlyContinue
        Remove-Job $job -Force -ErrorAction SilentlyContinue
    }
    # Kill any remaining processes on our ports
    foreach ($p in $portsToFree) { Free-Port $p }
    Log-Info "All services stopped."
}
