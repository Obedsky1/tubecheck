@echo off
title CreatorShield Launcher
echo ============================================
echo   CreatorShield - Starting App...
echo ============================================
echo.

echo [1/2] Starting Backend (FastAPI on port 8000)...
start "CreatorShield Backend" cmd /k "cd /d "C:\all my startup\creatorshield\backend" && .\venv\Scripts\uvicorn.exe app.main:app --host 0.0.0.0 --port 8000 --reload"

timeout /t 3 /nobreak >nul

echo [2/3] Starting Frontend (Vite on port 8080)...
start "CreatorShield Frontend" cmd /k "cd /d "C:\all my startup\creatorshield\creator-shield-main" && npm run dev"

timeout /t 3 /nobreak >nul

echo [3/3] Starting Daily Monitoring Scheduler (Celery Beat)...
start "CreatorShield Monitoring Scheduler" cmd /k "cd /d "C:\all my startup\creatorshield\backend" && .\venv\Scripts\celery.exe -A app.celery_app beat --loglevel=info"

timeout /t 5 /nobreak >nul

echo.
echo ============================================
echo   App is starting!
echo   Open your browser to: http://localhost:8080
echo ============================================
echo.
echo You can close this window. The servers will
echo keep running in their own windows.
echo.
pause
