# Setup script for Windows PowerShell
Write-Host "Initializing CreatorShield Local Environment..." -ForegroundColor Cyan

# 1. Create Virtual Environment
if (-not (Test-Path "backend/venv")) {
    Write-Host "Creating Python virtual environment in backend/venv..."
    python -m venv backend/venv
}

# 2. Install dependencies
Write-Host "Installing Python dependencies..."
& backend/venv/Scripts/pip install -r backend/requirements.txt

# 3. Create Local Env File
if (-not (Test-Path "backend/.env")) {
    Write-Host "Generating default backend/.env from .env.example..."
    Copy-Item .env.example backend/.env
}

Write-Host "Setup Completed successfully! Start services using docker-compose up." -ForegroundColor Green
