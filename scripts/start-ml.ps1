$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$serviceRoot = Join-Path $repoRoot 'ml-service'
$pythonPath = Join-Path $serviceRoot '.venv/Scripts/python.exe'

if (!(Test-Path -LiteralPath $pythonPath)) {
    throw 'ML environment missing. Run python -m venv ml-service/.venv, then ml-service/.venv/Scripts/python.exe -m pip install -r ml-service/requirements.txt.'
}

if (!$env:HF_HOME) {
    $env:HF_HOME = Join-Path $repoRoot '.cache/huggingface'
}

Push-Location $serviceRoot
try {
    & $pythonPath -m uvicorn app.main:app --host 127.0.0.1 --port 8001
    if ($LASTEXITCODE -ne 0) {
        throw "ML service exited with code $LASTEXITCODE. Check the startup error above."
    }
} finally {
    Pop-Location
}
