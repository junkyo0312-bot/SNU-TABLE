@echo off
echo 백엔드 서버를 시작합니다...

REM 포트 4000 사용 중인 프로세스 확인 및 종료
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":4000" ^| findstr "LISTENING"') do (
    echo 포트 4000을 사용 중인 프로세스를 종료합니다 (PID: %%a)...
    taskkill /F /PID %%a >nul 2>&1
)

timeout /t 1 /nobreak >nul 2>&1

REM 서버 실행
cd /d %~dp0
call node_modules\.bin\tsx.cmd src\server.ts

pause


