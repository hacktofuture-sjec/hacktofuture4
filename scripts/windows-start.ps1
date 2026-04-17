$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Root = Resolve-Path (Join-Path $PSScriptRoot '..')
$BackendDir = Join-Path $Root 'backend'
$FrontendDir = Join-Path $Root 'frontend'
$RunDir = Join-Path $Root '.run'
New-Item -ItemType Directory -Force -Path $RunDir | Out-Null

function Stop-PidFile {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (-not (Test-Path $Path)) {
        return
    }

    $processId = (Get-Content $Path -ErrorAction SilentlyContinue | Select-Object -First 1).Trim()
    if ($processId -and (Get-Process -Id $processId -ErrorAction SilentlyContinue)) {
        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }

    Remove-Item $Path -Force -ErrorAction SilentlyContinue
}

function Stop-ProcessOnPort {
    param([Parameter(Mandatory = $true)][int]$Port)

    $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    foreach ($connection in $connections) {
        if ($connection.OwningProcess) {
            Stop-Process -Id $connection.OwningProcess -Force -ErrorAction SilentlyContinue
        }
    }
}

function Start-LoggedProcess {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string[]]$ArgumentList,
        [Parameter(Mandatory = $true)][string]$WorkingDirectory
    )

    $stdout = Join-Path $RunDir "$Name.stdout.log"
    $stderr = Join-Path $RunDir "$Name.stderr.log"
    $pidFile = Join-Path $RunDir "$Name.pid"

    Stop-PidFile -Path $pidFile

    $process = Start-Process `
        -FilePath $FilePath `
        -ArgumentList $ArgumentList `
        -WorkingDirectory $WorkingDirectory `
        -WindowStyle Hidden `
        -PassThru `
        -RedirectStandardOutput $stdout `
        -RedirectStandardError $stderr

    Set-Content -Path $pidFile -Value $process.Id
    return $process
}

function Wait-ForHttpOk {
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [int]$TimeoutSeconds = 60
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
                return
            }
        } catch {
            Start-Sleep -Seconds 1
        }
    }

    throw "Timed out waiting for $Url"
}

function Ensure-BackendVenv {
    $PythonExe = Join-Path $BackendDir 'venv\Scripts\python.exe'
    if (-not (Test-Path $PythonExe)) {
        Write-Host 'Backend venv missing; creating it now...'
        Push-Location $BackendDir
        try {
            uv venv --python 3.12 venv | Out-Null
        } finally {
            Pop-Location
        }
    }

    if (-not (Test-Path $PythonExe)) {
        throw 'Backend venv could not be created. Install Python 3.12 and rerun scripts/windows-setup.ps1.'
    }

    Push-Location $BackendDir
    try {
        uv pip install --python $PythonExe -r requirements.txt | Out-Null
        & $PythonExe init_db.py | Out-Null
    } finally {
        Pop-Location
    }

    return ([string]$PythonExe)
}

foreach ($port in 3000, 8000, 9090, 3100, 3200, 3300) {
    Stop-ProcessOnPort -Port $port
}

kubectl config use-context kind-t3ps2 | Out-Null
kubectl get nodes | Out-Null

$portForwards = @(
    @{ Name = 'pf-prometheus'; Args = @('port-forward', 'svc/prometheus-server', '9090:80', '-n', 'monitoring') },
    @{ Name = 'pf-loki'; Args = @('port-forward', 'svc/loki', '3100:3100', '-n', 'monitoring') },
    @{ Name = 'pf-tempo'; Args = @('port-forward', 'svc/tempo', '3200:3200', '-n', 'monitoring') },
    @{ Name = 'pf-grafana'; Args = @('port-forward', 'svc/grafana', '3300:80', '-n', 'monitoring') }
)

foreach ($item in $portForwards) {
    Start-LoggedProcess -Name $item.Name -FilePath 'kubectl' -ArgumentList $item.Args -WorkingDirectory $Root | Out-Null
}

$PythonExe = Ensure-BackendVenv
Start-LoggedProcess -Name 'backend' -FilePath $PythonExe -ArgumentList @('-m', 'uvicorn', 'main:app', '--reload', '--host', '0.0.0.0', '--port', '8000') -WorkingDirectory $BackendDir | Out-Null

Wait-ForHttpOk -Url 'http://localhost:8000/healthz' -TimeoutSeconds 90
Invoke-RestMethod -Uri 'http://localhost:8000/admin/load-scenarios' -Method Post | Out-Null

if (Test-Path (Join-Path $FrontendDir 'package.json')) {
    if (-not (Test-Path (Join-Path $FrontendDir 'node_modules'))) {
        Push-Location $FrontendDir
        try {
            npm install
        } finally {
            Pop-Location
        }
    }

    Start-LoggedProcess -Name 'frontend' -FilePath 'npm.cmd' -ArgumentList @('run', 'dev', '--', '-p', '3000') -WorkingDirectory $FrontendDir | Out-Null
}

Write-Host ''
Write-Host 'Windows runtime started.'
Write-Host 'Backend:   http://localhost:8000/docs'
Write-Host 'Frontend:  http://localhost:3000'
Write-Host 'Grafana:   http://localhost:3300'
Write-Host 'Prometheus http://localhost:9090'
Write-Host 'Loki:      http://localhost:3100/ready'
Write-Host 'Tempo:     http://localhost:3200/ready'
Write-Host ''
Write-Host "Logs are in $RunDir"
Write-Host 'Use scripts/windows-stop.ps1 to stop the tracked processes.'
