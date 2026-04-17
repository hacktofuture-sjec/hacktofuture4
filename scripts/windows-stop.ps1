$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Root = Resolve-Path (Join-Path $PSScriptRoot '..')
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

$pidFiles = @(
    'backend.pid',
    'frontend.pid',
    'pf-prometheus.pid',
    'pf-loki.pid',
    'pf-tempo.pid',
    'pf-grafana.pid'
)

foreach ($pidFile in $pidFiles) {
    Stop-PidFile -Path (Join-Path $RunDir $pidFile)
}

Write-Host 'Stopped tracked Windows runtime processes.'
Write-Host 'If you want to delete the cluster too, run: kind delete cluster --name t3ps2'
