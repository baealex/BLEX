# Self-hosting Guide

이 문서는 Docker로 BLEX를 띄우고, 운영에 필요한 최소 설정을 확인한 뒤, 최초 관리자 생성과 첫 글 발행까지 끝내는 한 흐름의 가이드입니다.

BLEX의 기본 compose는 **HTTP로 접근 가능한 nginx 포트**를 제공합니다. 공개 운영에서는 이 포트를 서버의 앞단 nginx, Caddy, Cloudflare Tunnel, Traefik 같은 HTTPS 프록시에 연결하세요. 인증서, HTTP→HTTPS 리다이렉트, HSTS는 BLEX 내부가 아니라 앞단 프록시에서 처리하는 것을 권장합니다.

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
| `SITE_URL` | BLEX가 외부에 공개할 기준 origin. 예: `https://blog.example.com`. 프로토콜을 포함하고, 끝의 `/`, path, query를 붙이지 않음 |
| `RESOURCE_URL` | 기본값은 빈 값. 정적 파일과 업로드 파일을 다른 origin에서 서빙할 때만 설정 |
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
운영에서는 북마크, 모니터링, 여러 worker 구성을 고려해 고정된 `ADMIN_PATH`를 쓰는 편이 안전합니다.

## 2. 앞단 HTTPS 프록시 연결

BLEX는 기본적으로 `docker-compose.yml`의 nginx를 통해 HTTP 포트 하나를 엽니다.

```text
인터넷
→ 앞단 HTTPS 프록시
→ BLEX nginx HTTP 포트
→ Django backend
```

운영 서버에서는 앞단 HTTPS 프록시에서 아래를 처리하세요.

* TLS 인증서 발급과 갱신
* HTTP에서 HTTPS로 리다이렉트
* HSTS 적용 여부
* 공개 도메인에서 BLEX HTTP 포트로 프록시

BLEX 내부 Django는 `SITE_URL`을 기준으로 sitemap, RSS, canonical URL, `/llms.txt`, Markdown URL 같은 공개 URL을 만듭니다. 따라서 앞단 프록시에서 실제로 공개하는 origin과 `SITE_URL`을 맞춰야 합니다.

`SITE_URL`의 `https://`는 BLEX가 HTTPS 인증서나 리다이렉트를 직접 처리한다는 뜻이 아닙니다. 외부 도구에 광고할 정식 URL을 만들기 위한 기준값입니다. HTTP→HTTPS 리다이렉트, 인증서, HSTS, 프록시 보안 검증은 BLEX CI나 앱 내부 E2E 테스트 대상이 아니라 운영자가 사용하는 앞단 프록시의 책임입니다.

### nginx 앞단 프록시 예시

```nginx
server {
    listen 80;
    server_name blog.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name blog.example.com;

    ssl_certificate /etc/letsencrypt/live/blog.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/blog.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:20002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Caddy, Cloudflare Tunnel, Traefik을 쓰는 경우에도 원칙은 같습니다. 앞단 도구가 HTTPS를 처리하고, BLEX에는 HTTP로 넘깁니다. 이때 BLEX가 원래 요청의 HTTPS 여부를 알 수 있도록 `X-Forwarded-Proto`가 전달되어야 합니다. BLEX Docker 이미지 안의 nginx는 이 헤더가 들어오면 Django까지 보존해서 전달합니다.

## 3. 실행

```bash
docker compose up -d
docker compose logs -f backend
```

기본 Docker 이미지는 작은 서버를 고려해 Gunicorn worker를 1개로 실행합니다. `docker-compose.yml`은 이 기본 실행값을 그대로 사용합니다. 512MB급 서버에서는 이 설정으로 시작하고, 메모리 여유가 확인된 경우에만 compose의 `command`로 worker 수를 직접 덮어쓰세요.

운영 환경값을 바꾼 뒤에는 Django system check를 실행합니다.

```bash
docker compose exec backend python manage.py check
```

`SITE_URL`이 비어 있거나 로컬 주소면 BLEX 공개 URL 경고가 표시됩니다. 운영 공개 전에는 `SITE_URL`, `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`를 실제 도메인 기준으로 맞춥니다.

## 4. 최초 관리자 생성

backend 로그에 출력되는 `Initial setup URL`을 브라우저에서 엽니다.

```text
Initial setup URL: https://blog.example.com/setup?token=...
```

첫 관리자 계정을 만들면 `/admin-settings/site-settings`로 이동합니다. 이 계정은 Django 관리자 권한과 BLEX 작가 권한을 함께 받습니다.

소셜 로그인을 사용할 경우 Google/GitHub 개발자 콘솔에서 OAuth 앱을 만든 뒤 BLEX 어드민의 로그인 관리 화면에 Client ID와 Client Secret을 저장합니다. 자세한 절차는 [`SOCIAL_LOGIN.md`](./SOCIAL_LOGIN.md)를 참고하세요.

텔레그램 알림을 사용할 경우 `/admin-settings/integrations`의 텔레그램 화면에서 봇 사용자명과 봇 토큰을 저장합니다.

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
사이트 설정에서 올린 커스텀 로고와 아이콘도 업로드 파일에 포함됩니다. 기본 `docker-compose.yml`처럼 DB와 `resources/media`를 호스트에 유지하면 새 Docker 이미지를 pull 받아도 커스텀 브랜딩은 그대로 유지됩니다.
DB에는 커스텀 브랜딩 경로가 남아 있지만 media 파일이 빠진 경우, 공개 화면은 깨진 이미지 대신 기본 BLEX 로고와 아이콘으로 돌아갑니다. 설정 화면에서는 기존 커스텀 기록을 삭제하거나 다시 업로드할 수 있습니다.
SQLite를 사용하는 동안에는 실행 중인 DB 파일을 단순 복사하는 대신 SQLite 백업 명령이나 서비스 중지 후 복사를 사용하세요.
백업은 만드는 것에서 끝내지 말고, 별도 위치에서 복원 리허설을 해 실제로 부팅되는지 확인합니다.
DB와 media는 같은 시점의 짝으로 보관해야 글 본문과 이미지 참조가 어긋나지 않습니다.

## 7. 운영 설정 점검표

공개 도메인으로 열기 전에 BLEX 설정 기준으로 아래 항목을 확인합니다. 실제 HTTPS 프록시 자체의 동작 검증은 이 문서의 자동 테스트 범위가 아니며, 사용 중인 nginx, Caddy, Cloudflare Tunnel, Traefik 설정에서 별도로 관리합니다.

### 환경값

* [ ] `DEBUG=FALSE`
* [ ] `SITE_URL`이 실제 HTTPS origin이며 끝의 `/`, path, query가 없음
* [ ] `ALLOWED_HOSTS`에 실제 도메인이 있음
* [ ] `CSRF_TRUSTED_ORIGINS`에 실제 HTTPS origin이 있음
* [ ] `SECRET_KEY`, `CIPHER_KEY`, `INITIAL_SETUP_TOKEN`이 샘플 값이 아님
* [ ] 운영에서 같은 관리자 경로가 필요하면 `ADMIN_PATH`를 고정함

### 앞단 HTTPS 프록시와 공개 URL

* [ ] `docker compose exec backend python manage.py check` 결과를 확인함
* [ ] 앞단 HTTPS 프록시가 인증서 발급, 갱신, HTTP→HTTPS 리다이렉트를 책임지는 구조임
* [ ] BLEX HTTP 포트가 필요한 범위에서만 접근 가능함
* [ ] 글 상세의 canonical, Open Graph URL, RSS, sitemap, `/llms.txt`, Markdown URL이 `SITE_URL` 기준 HTTPS 주소로 나옴

### 정적 파일, 업로드, 로그

* [ ] `/resources/staticfiles/`가 200 또는 404로 정상 응답하고 Django로 프록시되지 않음
* [ ] `/resources/media/` 업로드 파일이 필요한 범위에서 응답함
* [ ] 업로드 media URL은 비밀 저장소가 아니며, URL을 아는 사람은 접근할 수 있음을 운영자가 알고 있음
* [ ] Docker 로그 회전 또는 외부 로그 수집을 설정함
* [ ] 디스크 사용량 경고를 볼 수 있음

예시 Docker 로그 회전 설정:

```yaml
logging:
  driver: json-file
  options:
    max-size: "10m"
    max-file: "5"
```
