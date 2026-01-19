# SNU Table Backend Server Start Script
# PowerShell 실행 정책 문제를 우회하기 위한 스크립트

Write-Host "백엔드 서버를 시작합니다..." -ForegroundColor Green

# 포트 4000 사용 중인 프로세스 확인 및 종료
$portProcess = Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($portProcess) {
    Write-Host "포트 4000을 사용 중인 프로세스를 종료합니다 (PID: $portProcess)..." -ForegroundColor Yellow
    Stop-Process -Id $portProcess -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

# 서버 실행
Set-Location $PSScriptRoot
& ".\node_modules\.bin\tsx.cmd" "src\server.ts"


