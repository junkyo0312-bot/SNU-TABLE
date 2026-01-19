# SNU Table 프로젝트 설정 가이드

## 설치 완료 ✅

모든 의존성이 설치되었습니다.

## 실행 방법

### 방법 1: 프론트엔드와 백엔드를 동시에 실행 (권장)
```bash
npm run dev
```

이 명령어는 다음을 실행합니다:
- 프론트엔드 서버: http://localhost:5173
- 백엔드 서버: http://localhost:4000

### 방법 2: 개별 실행

**프론트엔드만 실행:**
```bash
npm run client
```

**백엔드만 실행:**
```bash
cd backend
npm start
```

## 접속 주소

- **프론트엔드**: http://localhost:5173
- **백엔드 API**: http://localhost:4000

## 환경 변수 (선택사항)

백엔드에서 이메일 인증 기능을 사용하려면 다음 환경 변수를 설정하세요:

```bash
# backend 폴더에 .env 파일 생성
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

> 참고: Gmail을 사용하는 경우, 2단계 인증을 활성화하고 앱 비밀번호를 생성해야 합니다.
> 환경 변수가 없어도 시뮬레이션 모드로 동작합니다.

## 문제 해결

### PowerShell 실행 정책 오류
다음 명령어로 실행:
```powershell
powershell -ExecutionPolicy Bypass -Command "npm run dev"
```

### 포트가 이미 사용 중인 경우
다른 프로세스가 포트를 사용 중일 수 있습니다. 프로세스를 종료하거나 다른 포트를 사용하세요.

## 프로젝트 구조

- `/` - 프론트엔드 (React + Vite)
- `/backend` - 백엔드 (Express + TypeScript)


