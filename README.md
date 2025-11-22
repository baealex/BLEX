
<p align="center">
    <a href="https://github.com/baealex/BLEX">
        <img alt="blex color logo" src="https://user-images.githubusercontent.com/35596687/76856570-de2b8a80-6896-11ea-8827-fc2f1966fa23.png" width="400">
    </a>
</p>

<p align="center">
    <strong>BLOG EXPRESS ME</strong><br>
    미니멀하고 실용적인 블로그 플랫폼
</p>

<p align="center">
    <img src="https://img.shields.io/badge/django-5-blue?style=flat-square">
    <img src="https://img.shields.io/badge/react-18-blue?style=flat-square">
    <img src="https://img.shields.io/badge/typescript-5-blue?style=flat-square">
</p>

<br>

## 소개

BLEX는 미니멀한 디자인과 실용성을 지향하는 오픈소스 블로그 플랫폼입니다. Django와 React 기반으로 구축되었으며, 개인 블로그 운영에 필요한 핵심 기능들을 제공합니다.

<p align="center">
    <img src="https://user-images.githubusercontent.com/35596687/144164653-d4ed4668-f872-4600-938d-a824bd4b8599.jpg" width="800">
</p>

<br>

## 주요 기능

### 콘텐츠 관리
- 위지윅 에디터 기반 글쓰기
- 임시 저장 및 자동 저장
- 시리즈와 태그를 통한 글 분류
- 댓글 시스템

### 사용자 관리
- 소셜 로그인 (GitHub, Google)
- TOTP 기반 2단계 인증
- 역할 기반 권한 시스템 (독자/편집자/관리자)

### 알림 및 활동
- 텔레그램 연동 실시간 알림
- 개인 대시보드 및 활동 기록
- GitHub 스타일 활동 히트맵

### 관리자 기능
- 정적 페이지 빌더
- 사용자 권한 관리
- 사이트 설정 관리

<br>

## 기술 스택

### Backend
- **Framework**: Django 5.x

### Frontend
- **Framework**: React 18
- **Styling**: Tailwind CSS
- **Build Tool**: Vite

### Infrastructure
- **Container**: Docker & Docker Compose
- **Web Server**: Nginx (프로덕션)

<br>

## 시작하기

### 요구사항

- Node.js 18+

### 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

개발 서버가 실행되면 `http://localhost:8000`으로 접속할 수 있습니다.

### 주요 명령어

```bash
# 백엔드 개발 서버
npm run server:dev

# 프론트엔드 개발 서버
npm run island:dev

# 테스트 실행
npm run server:test

# 타입 체크
npm run island:type-check
```

<br>

## 프로젝트 구조

```
BLEX/
├── backend/
│   ├── src/board/          # Django 애플리케이션
│   │   ├── models.py       # 데이터 모델
│   │   ├── views/          # 뷰 및 API
│   │   ├── services/       # 비즈니스 로직
│   │   └── admin/          # 관리자 설정
│   └── islands/            # React 프론트엔드
│       └── src/
│           ├── components/ # React 컴포넌트
│           ├── lib/        # API 클라이언트
│           └── utils/      # 유틸리티
├── scripts/                # 관리 스크립트
└── docker-compose.yml      # Docker 구성
```

<br>

## 라이센스

이 프로젝트는 MIT 라이센스 하에 배포됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참고하세요.

<br>

## 문의

프로젝트에 대한 문의사항이나 제안은 [im@baejino.com](mailto:im@baejino.com)으로 연락주세요.
