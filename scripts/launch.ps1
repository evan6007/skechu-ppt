[CmdletBinding()]
param([int]$Port = 8766)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$bridge = Join-Path $repoRoot 'app\bridge.py'
$studioUrl = "http://127.0.0.1:$Port/"

function Test-Skechu {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $studioUrl -TimeoutSec 2
        return $response.StatusCode -eq 200 -and $response.Content -match 'Skechu-PPT'
    } catch {
        return $false
    }
}

if (-not (Get-Command py -ErrorAction SilentlyContinue)) {
    throw 'Python 3 is required. Install it from python.org, then run this script again.'
}

if (-not (Test-Skechu)) {
    py -3 -c "import win32com.client" 2>$null
    if ($LASTEXITCODE -ne 0) {
        py -3 -m pip install -r (Join-Path $repoRoot 'requirements.txt')
    }
    Start-Process -FilePath 'py' -ArgumentList @('-3', $bridge, '--port', $Port) -WorkingDirectory (Join-Path $repoRoot 'app') -WindowStyle Hidden
    $ready = $false
    foreach ($attempt in 1..30) {
        Start-Sleep -Milliseconds 250
        if (Test-Skechu) { $ready = $true; break }
    }
    if (-not $ready) { throw "Skechu-PPT did not start on port $Port." }
}

Start-Process $studioUrl
