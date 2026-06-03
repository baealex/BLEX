<p align="center">
  <a href="https://github.com/baealex/BLEX">
    <img alt="BLEX Logo" src="https://user-images.githubusercontent.com/35596687/76856570-de2b8a80-6896-11ea-8827-fc2f1966fa23.png" width="340">
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/django-6.0.5-blue?style=flat-square" alt="Django">
  <img src="https://img.shields.io/badge/react-19-blue?style=flat-square" alt="React">
  <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License">
</p>

<br>

## BLEX

BLEX는 자기 도메인과 자기 서버에 올려 쓰는 블로그 앱입니다.

정적 블로그는 글을 고치기 어렵고, 설치형 블로그는 저비용 서버에서 운영하기에 부담이 생길 수 있습니다. BLEX는 저사양 서버에서도 운영할 수 있도록 글쓰기와 발행에 필요한 기능을 중심으로 구성합니다. 웹 에디터로 글을 쓰고, Docker로 운영하고, 공개 글은 HTML뿐 아니라 RSS, sitemap, Markdown URL로도 읽을 수 있게 합니다.

## 주요 기능

**글쓰기**

- Tiptap 기반 글 작성/수정
- 임시저장, 예약 발행, 숨김 글
- 커버 이미지, 시리즈, 태그
- Markdown 입력 기반 Developer API

**공개 표면**

- RSS
- sitemap index와 posts/series/static pages sitemap
- canonical URL과 Open Graph URL
- 공개 글 Markdown URL
- 공개 시리즈 Markdown URL
- 공개 정적 페이지 Markdown URL
- AI 공개 설정(AEO)이 켜진 경우 `/llms.txt`

**운영**

- Docker 기반 실행
- 최초 관리자 생성
- 사이트 이름, 로고, 아이콘 설정
- 공지, 배너, 알림, webhook 관리
- 사용자 권한 관리

**계정과 보안**

- GitHub, Google 소셜 로그인
- TOTP 기반 2단계 인증
- 개인 Developer API 토큰
- scope 기반 API 권한

## 공개 URL

| 경로 | 설명 |
| --- | --- |
| `/rss` | 사이트 RSS |
| `/sitemap.xml` | sitemap index |
| `/posts/sitemap.xml` | 공개 글 sitemap |
| `/llms.txt` | AI 공개 설정(AEO)이 켜진 경우 AI 에이전트용 진입점 |
| `/@{username}/{post_url}.md` | 공개 글 Markdown |
| `/@{username}/series/{series_url}.md` | 공개 시리즈 Markdown |
| `/static/{slug}.md` | 공개 정적 페이지 Markdown |
| `/api/developer/v1/docs` | Developer API 문서 |
| `/api/developer/v1/openapi.json` | Developer API OpenAPI schema |

비공개 글, 숨김 글, 임시저장, 아직 발행되지 않은 예약 글은 RSS, sitemap, Markdown 공개 URL에 노출되지 않습니다.

## 로컬 개발

요구사항:

- Python 3.12+
- Node.js 22.12+
- npm

```bash
npm install
npm run server:migrate  # 최초 1회
npm run dev
```

접속: `http://localhost:8000`

## Docker 운영

Docker로 운영하려면 [Self-hosting Guide](docs/SELF_HOSTING.md)를 확인하세요.

Docker 기본 backend worker는 1개입니다. 512MB RAM급 서버에서도 쓰는 것을 염두에 둔 설정입니다.

가이드에서 다루는 내용:

- 운영 환경값
- HTTPS 앞단 프록시
- 최초 관리자 생성
- 첫 글 발행
- DB와 media 백업
- 운영 점검표

## Developer API

Developer API는 외부 도구에서 글을 만들고 발행하기 위한 개인 토큰 API입니다.

- 빠른 시작: `/docs/developer-api/quickstart`
- API 문서: `/api/developer/v1/docs`
- OpenAPI schema: `/api/developer/v1/openapi.json`

기본 흐름:

- 토큰과 계정 확인
- 포스트 목록/상세 조회
- Markdown 또는 HTML 초안 생성
- 이미지 업로드
- 초안 수정
- 발행
- 태그와 시리즈 조회

## 자주 쓰는 명령어

- `npm run server:dev`
- `npm run islands:dev`
- `npm run server:test`
- `npm run islands:lint`
- `npm run islands:type-check`

## 관련 문서

- [Development Convention](docs/DEV_CONVENTION.md)
- [Self-hosting Guide](docs/SELF_HOSTING.md)
- [Backend Guide](docs/BACKEND_GUIDE.md)
- [Frontend Guide](docs/FRONTEND_GUIDE.md)
- [Design Guide](docs/DESIGN_GUIDE.md)

## 라이선스

[MIT License](LICENSE)
