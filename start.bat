@echo off
rem Starts the AIQuake backend and frontend in two windows (Windows, local venv).
cd /d "%~dp0"
start "AIQuake API" cmd /k "cd backend && ..\venv\Scripts\python.exe -m uvicorn app:app --reload --port 8000"
start "AIQuake UI" cmd /k "cd frontend && npm run dev"
echo API:  http://127.0.0.1:8000/docs
echo UI:   http://localhost:5173
