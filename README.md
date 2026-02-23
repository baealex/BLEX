<p align="center">
  <a href="https://github.com/baealex/BLEX">
    <img alt="BLEX Logo" src="https://user-images.githubusercontent.com/35596687/76856570-de2b8a80-6896-11ea-8827-fc2f1966fa23.png" width="360">
  </a>
</p>

<p align="center">
  <strong>BLOG EXPRESS ME</strong><br>
  미니멀하고 실용적인 블로그 플랫폼
</p>

<p align="center">
  <img src="https://img.shields.io/badge/django-6.0.2-blue?style=flat-square" alt="Django">
  <img src="https://img.shields.io/badge/react-19-blue?style=flat-square" alt="React">
  <img src="https://img.shields.io/badge/theme-light%20%2F%20dark-black?style=flat-square" alt="Theme">
</p>

## 주요 기능

### 콘텐츠 작성/발행

- Tiptap 기반 게시글 작성/수정
- 임시저장 및 시리즈/태그 기반 분류

### 커뮤니티

- 댓글 시스템
- GitHub 스타일 활동 히트맵

### 인증/보안

- 소셜 로그인 (GitHub, Google)
- TOTP 기반 2단계 인증(2FA)

### 운영/관리

- 설정 앱 기반 관리자 UX
- 알림, 배너, 공지 관리

## 아키텍처

- **Backend**: Django 6.0.2
- **Frontend**:
  - Template 상호작용: Alpine.js
  - Islands: React 19 (Vite + Turbo + pnpm workspace)
- **UI/Design**:
  - Tailwind CSS 4
  - Semantic Design Tokens
  - `html[data-theme]` 기반 Light/Dark

## 빠른 시작

### 요구사항

- Python 3.12+
- Node.js 22.12+
- npm

### 설치

```bash
npm install
```

`npm install` 시 다음이 함께 수행됩니다.
- Django 가상환경 생성 및 Python 의존성 설치
- Islands 워크스페이스 의존성 설치

### 실행

```bash
# (최초 1회 권장) DB 마이그레이션
npm run server:migrate

# 백엔드 + islands 동시 실행
npm run dev
```

접속: `http://localhost:8000`

## 자주 쓰는 명령어

| 목적 | 명령어 |
|:---|:---|
| 전체 개발 실행 | `npm run dev` |
| 백엔드만 실행 | `npm run server:dev` |
| 프론트만 실행 | `npm run islands:dev` |

## 프로젝트 구조

```text
BLEX/
├── backend/
│   ├── src/                         # Django app (models/views/templates/tests)
│   └── islands/                     # React islands monorepo
│       ├── apps/remotes             # 페이지별 islands 엔트리
│       └── packages/{ui,editor}     # 공용 UI/에디터 패키지
├── docs/                            # 개발/디자인 가이드
├── scripts/                         # setup/manage 유틸 스크립트
└── docker-compose.yml               # 컨테이너 실행 정의
```

## 관련 문서

- `docs/DEV_CONVENTION.md`
- `docs/BACKEND_GUIDE.md`
- `docs/FRONTEND_GUIDE.md`
- `docs/DESIGN_GUIDE.md`

## 라이선스

[MIT License](LICENSE)
