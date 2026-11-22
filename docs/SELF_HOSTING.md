# BLEX 자체 호스팅

BLEX 4는 Node.js 프로세스 한 개가 블로그, 관리자 화면과 API를 제공합니다. Docker Compose는 서비스를 시작하기 전에 같은 데이터 볼륨에 Prisma 마이그레이션을 적용합니다.

## 새로 설치

저장소 루트에 `.env`를 만듭니다.

| 설정 | 값 |
| --- | --- |
| `SITE_URL` | 사용자가 접속할 origin. 로컬 예시 `http://localhost:20002`, 운영 예시 `https://blog.example.com` |
| `SECRET_KEY` | `openssl rand -hex 32`로 만든 임의 값 |
| `CIPHER_KEY` | `openssl rand -hex 16`로 만든 32바이트 ASCII 값 |
| `INITIAL_SETUP_TOKEN` | 선택 사항. 비워 두면 시작할 때 생성하고 최초 설정 URL에 표시 |
| `BLEX_DATA` | 선택 사항. Compose에서는 기본 named volume `blex-data`. 호스트 디렉터리를 쓸 때는 절대 경로 |
| `BLEX_PORT_MAPPING` | 선택 사항. 기본값 `127.0.0.1:20002:8040` |
| `BLEX_TRUSTED_PROXIES` | HTTPS 프록시 뒤에서는 필수. BLEX에 직접 접속하는 프록시의 IP 또는 CIDR을 쉼표로 구분 |
| `DEVELOPER_API_MAX_UPLOAD_MB` | 선택 사항. 글 이미지와 동영상 업로드 상한, 기본 20MB |
| `TZ` | 선택 사항. 지역 시간대 설정 |

```sh
docker compose up --build -d
docker compose logs blex
```

로그의 `/setup` 주소를 열어 첫 관리자를 만듭니다. 관리자 설정에서 사이트 이름, 로그인과 운영 옵션을 관리할 수 있습니다.

## HTTPS 프록시

공개 운영에서는 nginx, Caddy 등의 앞단에서 HTTPS를 종료하고 BLEX의 HTTP 포트로 전달합니다. `SITE_URL`에는 브라우저에서 쓰는 HTTPS origin을 설정합니다. 이 주소가 canonical URL, 공유 링크, OAuth 콜백, RSS와 sitemap에 사용됩니다.

같은 호스트의 프록시는 기본 포트 매핑을 사용해 `127.0.0.1:20002`로 연결할 수 있습니다. 접속 IP를 사용한 로그인 제한을 위해 프록시가 전달 헤더를 실제 값으로 설정하도록 구성하고, BLEX가 관측하는 프록시 주소를 `BLEX_TRUSTED_PROXIES`에 지정합니다. 이 값이 없으면 모든 방문자가 하나의 로그인 제한을 함께 쓰므로, 틀린 로그인 5번에 전체 로그인이 5분간 막힐 수 있습니다. 프록시의 본문 크기 제한도 업로드 상한에 맞춥니다.

## 백업

데이터 볼륨에는 `db.sqlite3`과 `media/`가 있습니다. 두 항목을 같은 시점에 백업하고 환경 파일도 보관합니다. 서비스가 DB를 사용하는 동안에는 SQLite의 백업 기능 또는 일관된 스냅샷을 사용합니다. 작업 일지 첨부는 `media/_work_logs/`에 저장되며 BLEX가 소유자나 공유 권한을 확인하고 제공합니다. 별도 정적 서버를 붙이는 경우 이 경로를 공개 경로에서 제외합니다.

## 이미지로 직접 실행

Compose 대신 직접 컨테이너를 실행하려면 저장소 루트에서 이미지 두 개를 빌드합니다.

```sh
docker build --target migration -t blex4-migration .
docker build -t blex4 .
export BLEX_DATA=/absolute/path/to/blex4-data
mkdir -p "$BLEX_DATA/media"
```

컨테이너의 `node` 사용자(리눅스 UID 1000)가 데이터 디렉터리와 미디어 하위 디렉터리를 읽고 쓸 수 있도록 소유권을 맞춥니다. SQLite 저널 파일도 이 디렉터리에 작성됩니다.

빈 데이터 디렉터리에 스키마를 적용하고, 위 설정을 저장한 환경 파일로 서비스를 실행합니다.

```sh
docker run --rm --user 1000:1000 \
  --mount "type=bind,source=$BLEX_DATA,target=/var/lib/blex" \
  -e DATABASE_URL=file:/var/lib/blex/db.sqlite3 blex4-migration
docker run --rm --env-file /absolute/path/to/blex.env \
  --mount "type=bind,source=$BLEX_DATA,target=/var/lib/blex" \
  -p 127.0.0.1:20002:8040 blex4
```

이후 업데이트에서도 서비스 시작 전에 같은 데이터 디렉터리에 마이그레이션을 적용합니다. 서비스 이미지는 FFmpeg와 두 프런트엔드 빌드를 포함합니다.

## 기존 설치에서 이전

[BLEX 3.14에서 4로 이전](UPGRADE_FROM_3.md)에 DB 기준선 등록, 환경 파일과 포트 변경, 전환 후 확인 절차를 정리했습니다.
