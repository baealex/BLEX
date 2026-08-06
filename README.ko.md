<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="backend/src/resources/logow.svg">
    <img alt="BLEX" src="backend/src/resources/logob.svg" width="108">
  </picture>
</p>

<h1 align="center">BLEX</h1>

<p align="center">
  <strong>인디 개발자를 위한 셀프 호스팅 퍼블리싱 공간.</strong><br>
  브라우저에서 쓰고, 내 도메인으로 발행하고, 어디서든 읽히게 하세요.
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

## 소유하기 쉬우면서 사용하기도 쉬운 블로그

블로그 하나를 소유하기 위해 매번 저장소의 Markdown을 고치거나,
거대한 CMS를 운영할 필요는 없어야 합니다.

BLEX는 그 중간에 있습니다. 도메인과 작은 서버를 준비하면 글쓰기에
집중할 수 있는 작업 공간, 공개 블로그, 그리고 둘을 운영하는 도구를
제공합니다. 다시 빌드하지 않고 글을 고쳐 발행하면서도 콘텐츠, 미디어,
데이터베이스와 URL은 직접 통제하는 인프라에 둘 수 있습니다.

개인 블로그, 빌드 로그, 기술 글쓰기와 작은 팀의 퍼블리싱에 잘 맞습니다.
BLEX는 Docker 운영과 백업을 직접 할 수 있는 사용자를 가정합니다.
호스팅 서비스나 런타임이 전혀 없는 정적 사이트 생성기는 아닙니다.

## 제공하는 것

| 영역 | 포함된 기능 |
| --- | --- |
| 글쓰기 | Tiptap 리치 텍스트 에디터, 임시저장, 자동저장 복구, 수정 이력, 미리보기, 예약 발행, 숨김 글, 커버, 시리즈, 태그 |
| 공개 블로그 | 반응형 글·작가 페이지, 검색, 댓글, 좋아요, 고정 글, 공지, 배너, 정적 페이지 |
| 소유권 | 직접 관리하는 도메인, SQLite 데이터베이스, 업로드 미디어, 브랜딩과 배포 환경 |
| 발견 가능성 | RSS, sitemap, canonical·Open Graph 메타데이터, 공개 Markdown URL, 선택형 `/llms.txt` |
| 자동화 | 개인 Developer API 토큰, scope 권한, Markdown·HTML 발행, 이미지 업로드, OpenAPI schema, 요청 로그 |
| 운영 | Docker 배포, 최초 관리자 설정, 사용자 역할, 소셜 로그인, TOTP 2단계 인증, webhook, 텔레그램 알림, 유지보수 도구 |
| 언어 | 기여하기 쉬운 카탈로그로 분리한 영어·한국어 제품 UI. 사용자가 작성한 콘텐츠는 원문 그대로 보존 |

## Docker로 사용해 보기

Git, Docker와 Docker Compose가 필요합니다. 아래 명령은 공개 이미지를
사용해 로컬에서 BLEX를 실행합니다.

```bash
git clone https://github.com/baealex/BLEX.git
cd BLEX
cp samples/.env backend/.env
mkdir -p backend/src/resources/media
touch backend/src/db.sqlite3
docker compose up -d
docker compose logs -f blex
```

`http://localhost:20002`에 접속하세요. 로그에 출력된 `Initial setup URL`을
열어 최초 관리자를 만든 다음 `/write`에서 첫 글을 작성할 수 있습니다.

샘플 환경은 영어와 한국어 UI 협상을 활성화합니다. 기존 설치 환경에서는
`ENABLE_ENGLISH_UI=TRUE`를 설정해 활성화할 수 있습니다. BLEX가 번역하는
것은 제품 인터페이스이며, 글과 사용자가 만든 콘텐츠는 자동 번역하지 않습니다.

외부에 공개하기 전에는 다음 항목을 확인하세요.

- `SECRET_KEY`, `CIPHER_KEY`, 최초 설정 토큰을 새 값으로 교체합니다.
- `DEBUG=FALSE`와 함께 `SITE_URL`, `ALLOWED_HOSTS`,
  `CSRF_TRUSTED_ORIGINS`를 설정합니다.
- Caddy, nginx, Traefik, Cloudflare Tunnel 같은 HTTPS 프록시를 앞단에 둡니다.
- `backend/src/db.sqlite3`와 `backend/src/resources/media`를 함께 백업합니다.

전체 배포 및 복구 점검표는 [셀프 호스팅 가이드](docs/SELF_HOSTING.md)를
확인하세요.

## 한 번 발행하고, 여러 경로에서 발견되기

BLEX는 공개 웹사이트를 렌더링된 HTML만으로 한정하지 않습니다.

| 경로 | 용도 |
| --- | --- |
| `/rss` | 사이트 RSS 피드 |
| `/sitemap.xml` | sitemap index |
| `/posts/sitemap.xml` | 공개 글 sitemap |
| `/llms.txt` | AEO가 활성화된 경우 AI 에이전트 진입점 |
| `/@{username}/{post_url}.md` | 공개 글 Markdown |
| `/@{username}/series/{series_url}.md` | 공개 시리즈 Markdown |
| `/static/{slug}.md` | 공개 정적 페이지 Markdown |
| `/api/developer/v1/docs` | 대화형 Developer API 문서 |
| `/api/developer/v1/openapi.json` | Developer API OpenAPI schema |

비공개 글, 숨김 글, 임시저장, 삭제된 글과 아직 발행되지 않은 예약 글은
RSS, sitemap과 공개 Markdown 표면에 노출되지 않습니다.

## Developer API

Developer API를 사용하면 스크립트, 개인 도구, AI 보조 워크플로에서도
BLEX의 권한과 글 생명주기를 우회하지 않고 글을 발행할 수 있습니다.

일반적인 흐름은 다음과 같습니다.

1. 필요한 scope만 가진 개인 토큰을 만듭니다.
2. Markdown 또는 HTML 임시 글을 만듭니다.
3. 이미지를 업로드하고 발행 메타데이터를 수정합니다.
4. 글을 미리 보거나 예약 또는 즉시 발행합니다.

BLEX를 실행한 뒤 `/docs/developer-api/quickstart`에서 단계별 안내를,
`/api/developer/v1/docs`에서 전체 API를 확인할 수 있습니다.

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

설정 스크립트가 Python 가상 환경을 만들고 필요한 경우 샘플 환경 파일을
복사합니다. Django는 `http://localhost:8000`에서 열리며 React islands
개발 서버가 함께 실행됩니다.

자주 사용하는 검사 명령어:

```bash
npm run server:test
npm run islands:i18n:check
npm run islands:test
npm run islands:lint
npm run islands:type-check
```

## 기술 구조

BLEX는 서버 렌더링 페이지, 인증, 권한과 발행 워크플로에 Django를
사용합니다. 에디터와 설정처럼 상호작용이 많은 영역에는 React를 작은
island 단위로 불러오며 전체 사이트를 클라이언트 애플리케이션으로 만들지
않습니다. 기본 데이터베이스는 SQLite이고, 운영 이미지는 작은 서버에
맞춘 기본 설정으로 nginx와 Gunicorn을 함께 실행합니다.

## 문서

- [셀프 호스팅 가이드](docs/SELF_HOSTING.md)
- [개발 규칙](docs/DEV_CONVENTION.md)
- [백엔드 가이드](docs/BACKEND_GUIDE.md)
- [프론트엔드 가이드](docs/FRONTEND_GUIDE.md)
- [번역 가이드](docs/TRANSLATION_GUIDE.md)
- [테스트 가이드](docs/TESTING_GUIDE.md)
- [디자인 가이드](docs/DESIGN_GUIDE.md)

특히 번역 기여를 환영합니다. 번역 가이드는 Django, React island, 에디터
카탈로그의 경계와 애플리케이션 코드를 바꾸지 않고 새 언어를 추가하는
방법을 설명합니다.

## 라이선스

BLEX는 [MIT License](LICENSE)로 제공됩니다.
