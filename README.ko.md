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

BLEX는 글을 쓰고, 정리하고, 발행하고, 오래 운영하는 흐름에 맞춰 만든
오픈소스 블로그 플랫폼입니다. 하나의 TypeScript 서버에서 Fastify,
React SSR, Prisma, SQLite로 블로그와 에디터, 관리 도구를 제공합니다.

## 프로젝트 방향

- **글쓰기와 발행:** 시각 편집과 마크다운, 미리보기, 임시저장, 자동저장 복구, 수정
  이력, 미리보기, 커버 이미지, 예약 발행
- **콘텐츠 관리:** 작가, 시리즈, 태그, 검색, 정적 페이지, 댓글, 좋아요,
  고정 글
- **블로그 운영:** 브랜딩, 공지와 배너, 사용자와 역할, webhook, 텔레그램
  연동
- **외부 활용:** RSS, sitemap, canonical과 Open Graph 메타데이터, 공개
  Markdown, 권한별 토큰을 제공하는 Developer API

GitHub 및 Google 로그인과 TOTP 2단계 인증을 제공합니다.
사용자가 작성한 콘텐츠는 번역하지 않고 원문 그대로 표시합니다.

## Docker로 로컬 실행

저장소 루트의 `.env`에 `SITE_URL=http://localhost:20002`, 충분히 긴 무작위
`SECRET_KEY`, 32바이트 `CIPHER_KEY`를 설정하세요. `openssl rand -hex 16`으로
32자 ASCII 암호화 키를 만들 수 있습니다.

```bash
docker compose up --build -d
docker compose logs blex
```

로그에 출력되는 `/setup` 링크에서 최초 관리자를 만드세요. 컨테이너를
교체해도 `blex-data` 볼륨에 데이터베이스와 업로드 파일이 유지됩니다.

### 운영 배포

고유한 비밀 키를 설정하고 `SITE_URL`에는 공개 HTTPS 주소를 지정하세요.
BLEX 앞단에는 HTTPS 프록시를 두고 데이터 디렉터리를 백업합니다.
3.x에서 업데이트할 때는 기존 SQLite와 미디어를 이관한 뒤 4.0을 실행합니다.
[BLEX 4 설치 및 이관 가이드](packages/server/README.md)

## 발행 인터페이스

| 경로 | 용도 |
| --- | --- |
| `/rss` | RSS 피드 |
| `/sitemap.xml` | sitemap index |
| `/llms.txt` | 선택형 AI 에이전트 진입점 |
| `/@{username}/{post_url}.md` | 공개 글 Markdown |
| `/api/developer/v1/docs` | Developer API 문서 |

## 개발

요구사항:

- Node.js 24 LTS(24.22.1 이상) 또는 26(26.12.1 이상)
- npm
- 로컬에서 GIF 변환과 동영상 미리보기를 사용할 경우 FFmpeg

```bash
pnpm install
pnpm dev
```

`http://localhost:8040`에 접속하세요. 개발 명령은 `packages/server/.local/`에 SQLite
DB를 초기화하고 최초 관리자 설정 링크를 출력합니다.

## 문서

- [BLEX 4 설치 및 이관 가이드](packages/server/README.md)
- [개발 규칙](docs/DEV_CONVENTION.md)
- [번역 가이드](docs/TRANSLATION_GUIDE.md)

## 라이선스

[MIT License](LICENSE)
