@echo off
chcp 65001 >nul
title Bank Application Server
echo ========================================
echo   Bank Application - Starting Server
echo ========================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed.
    echo Please download and install Node.js from: https://nodejs.org/
    pause
    exit /b 1
)

echo [INFO] Node.js found:
node --version
echo.

:: Check PostgreSQL
echo [INFO] Checking PostgreSQL...

:: Navigate to server directory
cd bank-server

:: Check if node_modules exists
if not exist "node_modules" (
    echo [1/3] Installing dependencies...
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] npm install failed!
        pause
        exit /b 1
    )
) else (
    echo [1/3] Dependencies already installed.
)

echo.
echo [2/3] Checking database...
echo.

call npm run init-db
if %ERRORLEVEL% neq 0 (
    echo.
    echo [WARNING] Database initialization had issues, but trying to start server anyway...
    echo.
)

echo.
echo [3/3] Starting Bank Server...
echo.
echo ========================================
echo   Server Starting...
echo ========================================
echo.
echo   Server URL: http://localhost:3001
echo.
echo   Serwer ip:
echo   - http://10.0.2.2:3001/
echo   - http://PC_IP:3001/
echo.
echo   Press Ctrl+C to stop the server
echo ========================================
echo.

:: Start server and keep window open
node server.js

:: If server stops, keep window open to see errors
echo.
echo ========================================
echo   Server stopped!
echo ========================================
echo.
pause
