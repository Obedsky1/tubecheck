# Runs Alembic migrations in Windows PowerShell
Write-Host "Running Alembic Database Migrations..." -ForegroundColor Cyan

& backend/venv/Scripts/alembic -c backend/alembic.ini upgrade head

Write-Host "Database migration successfully finalized." -ForegroundColor Green
