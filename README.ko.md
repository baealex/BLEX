<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="backend/src/resources/logow.svg">
    <img alt="BLEX" src="backend/src/resources/logob.svg" width="108">
  </picture>
</p>

<h1 align="center">BLEX</h1>

<p align="center">
  글쓰기부터 발행과 운영까지 다루는 오픈소스 블로그 플랫폼.
</p>

<p align="center">
  <a href="https://github.com/baealex/BLEX/actions/workflows/CI.yml"><img src="https://github.com/baealex/BLEX/actions/workflows/CI.yml/badge.svg" alt="CI"></a>
  <img src="https://img.shields.io/badge/Django-6.0-0C4B33?style=flat-square" alt="Django 6.0">
  <img src="https://img.shields.io/badge/React-19-149ECA?style=flat-square" alt="React 19">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT License"></a>
</p>

<p align="center">
  <a href="README.md">English</a> · 한국어
</p>

BLEX는 글을 쓰고, 정리하고, 발행하고, 오래 운영하는 흐름에 맞춰 만든
오픈소스 블로그 플랫폼입니다. 브라우저 에디터와 관리 도구를 함께
제공하며 Docker 배포를 기본으로 지원합니다.

## 프로젝트 방향

- **글쓰기와 발행:** 리치 텍스트 에디터, 임시저장, 자동저장 복구, 수정
  이력, 미리보기, 커버 이미지, 예약 발행
- **콘텐츠 관리:** 작가, 시리즈, 태그, 검색, 정적 페이지, 댓글, 좋아요,
  고정 글
- **블로그 운영:** 브랜딩, 공지와 배너, 사용자와 역할, webhook, 텔레그램
  연동
- **외부 활용:** RSS, sitemap, canonical과 Open Graph 메타데이터, 공개
  Markdown, 권한별 토큰을 제공하는 Developer API

GitHub 및 Google 로그인, TOTP 2단계 인증, 영어·한국어 UI도 제공합니다.
사용자가 작성한 콘텐츠는 번역하지 않고 원문 그대로 표시합니다.

## Docker로 로컬 실행

요구사항: Docker.

```bash
docker run -d \
  --name blex \
  --restart unless-stopped \
  -p 20002:80 \
  --mount source=blex-db,target=/var/lib/blex \
  --mount source=blex-media,target=/app/resources/media \
  -e BLEX_SQLITE_DB_PATH=/var/lib/blex/db.sqlite3 \
  -e SECRET_KEY=local-preview-only-change-me \
  -e CIPHER_KEY=local-only-cipher-key-32-charsxx \
  -e DEBUG=TRUE \
  -e ENABLE_ENGLISH_UI=TRUE \
  -e SITE_URL=http://localhost:20002 \
  baealex/blex:latest

docker logs blex
```

위 명령은 로컬 HTTP에서 실행하기 위해 개발용 설정인 `DEBUG=TRUE`를
사용합니다. 운영 환경에서는 이 값을 그대로 사용하면 안 됩니다.

`http://localhost:20002`에 접속한 뒤 `docker logs blex`에 출력된
`Initial setup URL`에서 최초 관리자를 만드세요. 컨테이너를 교체해도
`blex-db`와 `blex-media` 볼륨에 데이터베이스와 업로드 파일이 유지됩니다.

### 운영 배포

고유한 비밀 키를 사용하고 `DEBUG=FALSE`로 바꾼 뒤 `SITE_URL`,
`ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`를 공개 도메인에 맞게 설정하세요.
BLEX 앞단에는 HTTPS 프록시를 두고 두 볼륨을 함께 백업해야 합니다. 전체
설정과 업데이트 방법은 [셀프 호스팅 가이드](docs/SELF_HOSTING.md)에서
확인할 수 있습니다.

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

- Python 3.12+
- Node.js 22(22.22.2 이상), 24(24.15 이상) 또는 26 이상
- npm

```bash
npm install
npm run server:migrate
npm run dev
```

`http://localhost:8000`에 접속하세요.

## 문서

- [셀프 호스팅 가이드](docs/SELF_HOSTING.md)
- [개발 규칙](docs/DEV_CONVENTION.md)
- [번역 가이드](docs/TRANSLATION_GUIDE.md)

## 라이선스

[MIT License](LICENSE)
