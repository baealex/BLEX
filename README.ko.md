<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="backend/src/resources/logow.svg">
    <img alt="BLEX" src="backend/src/resources/logob.svg" width="108">
  </picture>
</p>

<h1 align="center">BLEX</h1>

<p align="center">
  자기 도메인과 서버에서 운영하는 셀프 호스팅 블로그 애플리케이션.
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

## 소개

BLEX는 직접 관리하는 인프라에서 실행하는 블로그 애플리케이션입니다.
브라우저 기반 에디터와 Docker 배포, 개인 블로그나 작은 퍼블리케이션을
운영하는 데 필요한 설정을 제공합니다.

공개 글은 일반 웹페이지뿐 아니라 RSS, sitemap, Markdown endpoint로도
제공됩니다. 기본 배포는 SQLite를 사용하며 작은 서버에서도 시작할 수
있도록 구성되어 있습니다.

## 주요 기능

**글쓰기와 발행**

- Tiptap 기반 리치 텍스트 에디터
- 임시저장, 자동저장 복구, 수정 이력, 미리보기
- 예약 발행과 숨김 글
- 커버 이미지, 시리즈, 태그
- Developer API를 통한 Markdown 또는 HTML 발행

**공개 블로그**

- 글, 작가, 시리즈, 태그, 검색, 정적 페이지
- 댓글, 좋아요, 고정 글
- RSS, sitemap, canonical URL, Open Graph 메타데이터
- 공개 Markdown URL과 선택형 `/llms.txt`

**운영**

- Docker 기반 배포
- 최초 관리자 설정
- 사이트 이름, 로고, 아이콘 설정
- 공지, 배너, 알림, webhook, 텔레그램 연동
- 사용자 역할과 관리 도구

**계정과 보안**

- GitHub, Google 소셜 로그인
- TOTP 2단계 인증
- scope 권한을 가진 개인 Developer API 토큰

**언어**

- 영어와 한국어 제품 UI
- 영어 UI 지원이 활성화된 경우 요청 언어에 따른 협상
- Django, React island, 에디터별 번역 카탈로그
- 글과 사용자가 작성한 콘텐츠는 원문 그대로 표시

## Docker로 실행

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

docker logs -f blex
```

`http://localhost:20002`에 접속하세요. 로그의 `Initial setup URL`에서
최초 관리자를 만들 수 있습니다. 컨테이너를 교체해도 `blex-db`와
`blex-media` 볼륨에 데이터베이스와 업로드 파일이 유지됩니다.

이 명령은 로컬 체험용이며 영어와 한국어 UI 협상을 활성화합니다. 기존
설치에서는 `ENABLE_ENGLISH_UI=TRUE`를 설정해 활성화할 수 있습니다.

외부에 공개하기 전에는 고유한 secret을 사용하고 `DEBUG=FALSE`로 바꾼 뒤
공개 사이트 URL과 허용 호스트를 설정해야 합니다. BLEX 앞단에 HTTPS
프록시를 두고 두 Docker 볼륨을 함께 백업하세요. 자세한 내용은
[셀프 호스팅 가이드](docs/SELF_HOSTING.md)를 확인하세요.

## 공개 URL

| 경로 | 설명 |
| --- | --- |
| `/rss` | 사이트 RSS 피드 |
| `/sitemap.xml` | sitemap index |
| `/posts/sitemap.xml` | 공개 글 sitemap |
| `/llms.txt` | AEO가 활성화된 경우 AI 에이전트 진입점 |
| `/@{username}/{post_url}.md` | 공개 글 Markdown |
| `/@{username}/series/{series_url}.md` | 공개 시리즈 Markdown |
| `/static/{slug}.md` | 공개 정적 페이지 Markdown |
| `/api/developer/v1/docs` | Developer API 문서 |
| `/api/developer/v1/openapi.json` | Developer API OpenAPI schema |

비공개 글, 숨김 글, 임시저장, 삭제된 글과 아직 발행되지 않은 예약 글은
RSS, sitemap과 공개 Markdown endpoint에서 제외됩니다.

## Developer API

Developer API는 개인 토큰, scope 권한, 글과 임시저장 관리, Markdown 또는
HTML 입력, 이미지 업로드, 발행, 태그와 시리즈를 지원합니다.

BLEX 실행 후 `/docs/developer-api/quickstart`에서 빠른 시작을,
`/api/developer/v1/docs`에서 전체 API 문서를 확인할 수 있습니다.

## 로컬 개발

요구사항:

- Python 3.12+
- Node.js 22.22.2, 24.15+, or 26+
- npm

```bash
npm install
npm run server:migrate
npm run dev
```

`http://localhost:8000`에 접속하세요.

자주 사용하는 검사 명령어:

```bash
npm run server:test
npm run islands:i18n:check
npm run islands:test
npm run islands:lint
npm run islands:type-check
```

## 문서

- [셀프 호스팅 가이드](docs/SELF_HOSTING.md)
- [개발 규칙](docs/DEV_CONVENTION.md)
- [백엔드 가이드](docs/BACKEND_GUIDE.md)
- [프론트엔드 가이드](docs/FRONTEND_GUIDE.md)
- [번역 가이드](docs/TRANSLATION_GUIDE.md)
- [테스트 가이드](docs/TESTING_GUIDE.md)
- [디자인 가이드](docs/DESIGN_GUIDE.md)

## 라이선스

[MIT License](LICENSE)
