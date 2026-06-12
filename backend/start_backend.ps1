NPM$ErrorActionPreference = "Stop"
$backendDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $backendDir
$env:PYTHONPATH = $backendDir
$pythonExe = Join-Path $backendDir "venv\Scripts\python.exe"
Write-Host "Starting backend from: $backendDir"
Write-Host "Using Python: $pythonExe"
& $pythonExe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
