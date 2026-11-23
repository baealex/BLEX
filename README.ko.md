<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="packages/server/public/logow.svg">
    <img alt="BLEX" src="packages/server/public/logob.svg" width="108">
  </picture>
</p>

<h1 align="center">BLEX</h1>

<p align="center">
  글쓰기부터 발행과 운영까지 다루는 오픈소스 블로그 플랫폼.
</p>

<p align="center">
  <a href="https://github.com/baealex/BLEX/actions/workflows/CI.yml"><img src="https://github.com/baealex/BLEX/actions/workflows/CI.yml/badge.svg" alt="CI"></a>
  <img src="https://img.shields.io/badge/Node.js-24-339933?style=flat-square" alt="Node.js 24">
  <img src="https://img.shields.io/badge/React-19-149ECA?style=flat-square" alt="React 19">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT License"></a>
</p>

<p align="center">
  <a href="README.md">English</a> · 한국어
</p>

## 주요 기능

- 시각 편집과 마크다운, 임시저장, 자동저장 복구, 수정 이력, 예약 발행
- 시리즈, 태그, 검색, 정적 페이지, 댓글, 좋아요, 고정 글
- 사이트 브랜딩, 사용자 역할, webhook, 텔레그램 연동
- RSS, sitemap, 공개 Markdown, Developer API
- GitHub·Google 로그인과 TOTP 2단계 인증

## Docker로 실행

저장소 루트의 `.env`에 `SITE_URL=http://localhost:20002`, 무작위 `SECRET_KEY`
(`openssl rand -hex 32`), 32바이트 `CIPHER_KEY`(`openssl rand -hex 16`)를 설정하세요.

```sh
docker compose up --build -d
docker compose logs blex
```

로그의 `/setup` 링크에서 최초 관리자를 만드세요.
데이터베이스와 업로드 파일은 `blex-data` 볼륨에 저장됩니다.

HTTPS, 백업, 환경 설정은 [자체 호스팅 가이드](docs/SELF_HOSTING.md)를 참고하세요.
기존 3.x 설치는 BLEX 4를 시작하기 전에 [이관 절차](docs/UPGRADE_FROM_3.md)를 따라야 합니다.

## 개발

Node.js 24 LTS(24.22.1 이상) 또는 26(26.12.1 이상)과 `package.json`에 지정된 pnpm을 사용합니다.

```sh
pnpm install
pnpm dev
```

`http://localhost:8040`에 접속하세요. 로컬 데이터는 `packages/server/.local/`에 저장됩니다.
화면 빌드와 검증 명령, 코드별 지침은 [개발 가이드](docs/DEV_CONVENTION.md)를 참고하세요.

## 문서

상세 가이드는 영어로 제공합니다.

- [자체 호스팅](docs/SELF_HOSTING.md)
- [소셜 로그인 설정](docs/SOCIAL_LOGIN.md)
- [BLEX 3.14에서 4로 이전](docs/UPGRADE_FROM_3.md)
- [기여 및 개발 규칙](docs/DEV_CONVENTION.md)

## 라이선스

[MIT License](LICENSE)
