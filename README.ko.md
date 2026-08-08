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

BLEX는 브라우저 에디터와 사이트 관리를 하나의 Docker 이미지로
제공합니다. 콘텐츠는 SQLite에 저장하며 웹, RSS, sitemap, Markdown,
Developer API로 발행할 수 있습니다.

## 주요 기능

- 임시저장, 자동저장 복구, 수정 이력, 미리보기, 예약 발행을 갖춘 리치
  텍스트 에디터
- 작가, 시리즈, 태그, 검색, 정적 페이지로 구성하는 공개 블로그
- 브랜딩, 사용자, 공지, 연동, 소셜 로그인, TOTP 2단계 인증을 위한 관리
  기능
- RSS, sitemap, Open Graph 메타데이터, 공개 Markdown, 권한 범위를 지정할 수
  있는 API 토큰
- 작성 콘텐츠의 언어는 그대로 유지하는 영어·한국어 UI

## 빠른 시작

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

`http://localhost:20002`에 접속하세요. 로그의 `Initial setup URL`에서
최초 관리자를 만들 수 있습니다. 컨테이너를 교체해도 `blex-db`와
`blex-media` 볼륨에 데이터베이스와 업로드 파일이 유지됩니다.

이 명령은 로컬 체험용입니다. 외부에 공개하기 전에는 고유한 비밀 키를
사용하고 `DEBUG=FALSE`로 바꾼 뒤 공개 주소와 HTTPS를 설정하고 두 볼륨을
백업하세요. 자세한 내용은 [셀프 호스팅 가이드](docs/SELF_HOSTING.md)를
확인하세요.

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
