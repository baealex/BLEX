<p align="center">
  <a href="https://github.com/baealex/BLEX">
    <img alt="BLEX Logo" src="https://user-images.githubusercontent.com/35596687/76856570-de2b8a80-6896-11ea-8827-fc2f1966fa23.png" width="340">
  </a>
</p>

<p align="center">
  <strong>BLEX</strong><br>
  Blog, Let me Express
</p>

<p align="center">
  <img src="https://img.shields.io/badge/django-6.0.2-blue?style=flat-square" alt="Django">
  <img src="https://img.shields.io/badge/react-19-blue?style=flat-square" alt="React">
</p>

## 소개

BLEX는 Django + React 기반 퍼블리싱 플랫폼입니다.
글쓰기 경험을 우선하고, 실제 운영 피드백으로 계속 개선합니다.

## 왜 BLEX인가

- `BLEX`는 닉네임 `baealex`의 축약형에서 시작했습니다.
- 지금은 **Blog, Let me Express** 의미를 함께 사용합니다.
- `blex.me`의 `me`는 운영자 한 명이 아니라, 글을 쓰는 각 사람을 뜻합니다.

자세한 배경: <https://baejino.com/projects/blex/>

## 주요 기능

**콘텐츠 작성/발행**
- Tiptap 기반 게시글 작성/수정
- 임시저장, 시리즈/태그 관리

**커뮤니티**
- 댓글 시스템
- GitHub 스타일 활동 히트맵

**인증/보안**
- 소셜 로그인 (GitHub, Google)
- TOTP 기반 2단계 인증(2FA)

**운영/관리**
- 설정 앱 기반 관리자 UX
- 알림, 배너, 공지 관리

## 빠른 시작

요구사항: Python 3.12+, Node.js 22.12+, npm

```bash
npm install
npm run server:migrate  # 최초 1회
npm run dev
```

접속: `http://localhost:8000`

## 자주 쓰는 명령어

- `npm run server:dev`
- `npm run islands:dev`
- `npm run server:test`
- `npm run islands:lint`
- `npm run islands:type-check`

## 관련 문서

- `docs/DEV_CONVENTION.md`
- `docs/BACKEND_GUIDE.md`
- `docs/FRONTEND_GUIDE.md`
- `docs/DESIGN_GUIDE.md`

## 라이선스

[MIT License](LICENSE)
