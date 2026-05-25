# Self-hosting Guide

이 문서는 Docker로 BLEX를 띄우고, 운영에 필요한 최소 설정을 확인한 뒤, 최초 관리자 생성과 첫 글 발행까지 끝내는 한 흐름의 가이드입니다.

## 1. 환경 파일 준비

```bash
cp samples/.env backend/.env
mkdir -p backend/src/resources/media
touch backend/src/db.sqlite3
```

운영 서버에서는 `backend/.env`에서 아래 값은 반드시 바꿉니다.

| 값 | 기준 |
| --- | --- |
| `DEBUG` | 운영에서는 `FALSE` |
| `SECRET_KEY` | 샘플 값이 아닌 긴 임의 문자열 |
| `CIPHER_KEY` | 샘플 값이 아닌 32글자 문자열 |
| `SITE_URL` | 실제 접속 주소. 예: `https://blog.example.com` |
| `SESSION_COOKIE_DOMAIN` | 단일 도메인이면 빈 값. 운영에서 `localhost`로 두지 않음 |
| `INITIAL_SETUP_TOKEN` | 최초 관리자 생성 화면 보호 토큰. 비워 두면 Docker 실행 시 자동 생성 |
| `ALLOWED_HOSTS` | 허용할 호스트 목록. 예: `blog.example.com` |
| `CSRF_TRUSTED_ORIGINS` | HTTPS 원본. 예: `https://blog.example.com` |

로컬 Docker 확인만 할 때는 `SITE_URL=http://localhost:20002`, `ALLOWED_HOSTS=localhost,127.0.0.1`, `CSRF_TRUSTED_ORIGINS=http://localhost:20002`처럼 맞춥니다.

`ALLOWED_HOSTS`를 비워 두면 기존처럼 `*`로 동작합니다. 운영 배포에서는 명시적인 호스트 목록을 설정하세요.

임의 문자열은 아래처럼 만들 수 있습니다.

```bash
python -c "import secrets; print(secrets.token_urlsafe(50))"
python -c "import secrets; print(secrets.token_urlsafe(24))"
```

첫 번째 값은 `SECRET_KEY`, 두 번째 값은 32글자라 `CIPHER_KEY`에 사용할 수 있습니다. `INITIAL_SETUP_TOKEN`은 직접 고정해도 되고, Docker 로그에 출력되는 자동 생성 값을 사용해도 됩니다.

`ADMIN_PATH`는 비워 두면 Docker 실행 시 자동 생성되고 backend 로그에 출력됩니다. 재시작 후에도 같은 관리자 경로를 유지하고 싶을 때만 직접 설정하세요.

## 2. HTTPS 프록시 설정

외부 nginx, Caddy, Cloudflare Tunnel 같은 프록시 뒤에서 HTTPS를 종료한다면 아래 값을 켭니다.

```env
SESSION_COOKIE_SECURE=TRUE
CSRF_COOKIE_SECURE=TRUE
TRUST_X_FORWARDED_PROTO=TRUE
```

BLEX 컨테이너가 직접 HTTPS를 받지 않는 구성에서는 `SECURE_SSL_REDIRECT=TRUE`를 켜기 전에 프록시가 `X-Forwarded-Proto: https`를 전달하는지 먼저 확인하세요.

HSTS는 HTTPS가 안정적으로 동작한 뒤에만 켭니다.

```env
SECURE_HSTS_SECONDS=31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS=TRUE
```

## 3. 실행

```bash
docker compose up -d
docker compose logs -f backend
```

기본 `docker-compose.yml`은 작은 서버를 고려해 Gunicorn worker를 1개로 실행합니다. 512MB급 서버에서는 이 설정으로 시작하고, 메모리 여유를 확인한 뒤 worker 수를 늘리세요.

## 4. 최초 관리자 생성

backend 로그에 출력되는 `Initial setup URL`을 브라우저에서 엽니다.

```text
Initial setup URL: https://blog.example.com/setup?token=...
```

첫 관리자 계정을 만들면 `/admin-settings/site-settings`로 이동합니다. 이 계정은 Django 관리자 권한과 BLEX 편집자 권한을 함께 받습니다.

## 5. 첫 글 발행

`/write`에서 제목과 본문을 입력하고 발행합니다. 공개 글은 공개 URL, Markdown URL, RSS, sitemap에 노출됩니다.

비공개 또는 예약 글은 공개 URL, RSS, sitemap, Markdown 공개 표면에 노출되지 않으며, 작성자에게는 글 상세 상단에 상태 안내가 표시됩니다.

## 6. 백업 확인

기본 compose는 아래 경로를 호스트에 보관합니다.

| 데이터 | 경로 |
| --- | --- |
| SQLite DB | `backend/src/db.sqlite3` |
| 업로드 파일 | `backend/src/resources/media` |

운영 전에 이 두 위치가 백업 대상에 포함되는지 확인하세요.
