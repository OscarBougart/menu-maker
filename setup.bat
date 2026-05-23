@echo off
REM ── The Menu Maker · one-click setup (Windows) ──
echo.
echo   Setting up The Menu Maker...
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   [!] Node.js not found. Install it from https://nodejs.org first, then re-run.
  pause
  exit /b 1
)

echo   Installing dependencies...
call npm install
if errorlevel 1 ( echo   [!] npm install failed. & pause & exit /b 1 )

if not exist .env (
  copy .env.example .env >nul
  echo.
  echo   [*] Created .env  --  OPEN IT and paste your Anthropic API key
  echo       after ANTHROPIC_API_KEY=
  echo       Get a key at https://console.anthropic.com/settings/keys
) else (
  echo   [*] .env already exists, leaving it as-is.
)

echo.
echo   Done. Next:
echo     1. Put your API key in .env (if you haven't)
echo     2. Run:  npm run dev
echo     3. Open the http://localhost:5173 link it prints
echo.
pause
