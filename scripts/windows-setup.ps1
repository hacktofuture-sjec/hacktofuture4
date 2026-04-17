$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Root = Resolve-Path (Join-Path $PSScriptRoot '..')
$BackendDir = Join-Path $Root 'backend'
$FrontendDir = Join-Path $Root 'frontend'
$RunDir = Join-Path $Root '.run'
New-Item -ItemType Directory -Force -Path $RunDir | Out-Null

function Assert-Command {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [string]$WingetId
    )

    if (Get-Command $Name -ErrorAction SilentlyContinue) {
        return
    }

    if (-not $WingetId) {
        throw "Required command '$Name' is missing. Install it and rerun this script."
    }

    Write-Host "Installing $Name via winget ($WingetId)..."
    winget install -e --id $WingetId
}

function Ensure-ClusterContext {
    $clusters = kind get clusters 2>$null
    if ($clusters -notmatch '^t3ps2$') {
        Write-Host 'Creating kind cluster t3ps2...'
        kind create cluster --name t3ps2 --config (Join-Path $Root 'k8s\kind-config.yaml')
    } else {
        Write-Host 'kind cluster t3ps2 already exists.'
    }

    kubectl config use-context kind-t3ps2 | Out-Null
    kubectl wait --for=condition=Ready node --all --timeout=180s
}

function Ensure-HelmRelease {
    param(
        [Parameter(Mandatory = $true)][string]$Release,
        [Parameter(Mandatory = $true)][string]$Chart,
        [Parameter(Mandatory = $true)][string]$ValuesFile
    )

    helm upgrade --install $Release $Chart --namespace monitoring -f $ValuesFile --wait --timeout 3m
}

Assert-Command -Name 'winget' -WingetId ''
Assert-Command -Name 'docker' -WingetId 'Docker.DockerDesktop'
Assert-Command -Name 'kubectl' -WingetId 'Kubernetes.kubectl'
Assert-Command -Name 'kind' -WingetId 'Kubernetes.kind'
Assert-Command -Name 'helm' -WingetId 'Helm.Helm'
Assert-Command -Name 'vcluster' -WingetId 'loft-sh.vcluster'
Assert-Command -Name 'uv' -WingetId 'astral-sh.uv'

try {
    docker info | Out-Null
} catch {
    throw 'Docker Desktop is not ready. Open Docker Desktop, wait for it to start, then rerun windows-setup.ps1.'
}

Ensure-ClusterContext

helm repo add prometheus-community https://prometheus-community.github.io/helm-charts | Out-Null
helm repo add grafana https://grafana.github.io/helm-charts | Out-Null
helm repo update | Out-Null

kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f - | Out-Null
kubectl create namespace prod --dry-run=client -o yaml | kubectl apply -f - | Out-Null
kubectl create namespace vcluster-sandboxes --dry-run=client -o yaml | kubectl apply -f - | Out-Null

Ensure-HelmRelease -Release 'prometheus' -Chart 'prometheus-community/prometheus' -ValuesFile (Join-Path $Root 'k8s\monitoring\prometheus-values.yaml')
Ensure-HelmRelease -Release 'loki' -Chart 'grafana/loki-stack' -ValuesFile (Join-Path $Root 'k8s\monitoring\loki-values.yaml')
Ensure-HelmRelease -Release 'tempo' -Chart 'grafana/tempo' -ValuesFile (Join-Path $Root 'k8s\monitoring\tempo-values.yaml')
Ensure-HelmRelease -Release 'grafana' -Chart 'grafana/grafana' -ValuesFile (Join-Path $Root 'k8s\monitoring\grafana-values.yaml')

kubectl apply -f (Join-Path $Root 'k8s\sample-app.yaml') | Out-Null
kubectl wait --for=condition=ready pod --all -n monitoring --timeout=180s
kubectl wait --for=condition=ready pod --all -n prod --timeout=180s

$PythonExe = Join-Path $BackendDir 'venv\Scripts\python.exe'
if (-not (Test-Path $PythonExe)) {
    Write-Host 'Creating backend venv...'
    Push-Location $BackendDir
    try {
        uv venv --python 3.12 venv
    } finally {
        Pop-Location
    }
}

Push-Location $BackendDir
try {
    uv pip install --python $PythonExe -r requirements.txt | Out-Null
    & $PythonExe init_db.py | Out-Null
} finally {
    Pop-Location
}

Write-Host ''
Write-Host 'Windows setup complete.'
Write-Host 'Next: run scripts/windows-start.ps1 to launch the runtime services.'
