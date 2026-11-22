# BLEX 3.14에서 4로 이전

새 설치와 일반 운영은 [자체 호스팅 가이드](SELF_HOSTING.md)를 따릅니다. 이 문서는 기존 SQLite DB, 미디어, 계정을 BLEX 4로 옮기는 절차입니다. 이전 코드와 문서는 Git 태그 `v3.14`에서 확인할 수 있습니다.

## 준비

- 3.14의 마지막 Django 마이그레이션은 `0070_author_subscription`입니다. 더 오래된 설치도 이 스키마까지 올린 뒤 이전합니다.
- 기존 비밀번호 해시와 소셜 계정 연결은 유지됩니다. 브라우저에서는 새로 로그인해야 합니다.
- 기존 `CIPHER_KEY`, `SECRET_KEY`, `SITE_URL`을 보존합니다. 특히 `CIPHER_KEY`를 바꾸면 저장된 소셜 로그인과 2단계 인증 비밀 값을 읽을 수 없습니다.

저장소 루트에서 마이그레이션 이미지를 빌드합니다.

```sh
docker build --target migration -t blex4-migration .
export BLEX_DATA=/absolute/path/to/blex4-data
mkdir -p "$BLEX_DATA/media"
```

## DB와 미디어 이전

1. 기존 서비스를 중지하고 SQLite DB, 미디어, 환경 파일을 백업합니다. SQLite CLI의 `.backup` 또는 일관된 스냅샷을 사용합니다. 원본을 보관하고, DB 복제본은 `$BLEX_DATA/db.sqlite3`, 미디어 복제본은 `$BLEX_DATA/media/`에 둡니다.
2. 복제본에 3.14의 마지막 스키마를 적용합니다.

   ```sh
   docker run --rm --env-file /absolute/path/to/blex3.env \
     --mount "type=bind,source=$BLEX_DATA/db.sqlite3,target=/app/db.sqlite3" \
     --mount "type=bind,source=$BLEX_DATA/media,target=/app/resources/media" \
     --entrypoint python baealex/blex:3.14 manage.py migrate --noinput
   ```

3. BLEX 4 컨테이너의 `node` 사용자(리눅스 UID 1000)가 복제한 데이터 디렉터리, DB와 미디어에 읽기·쓰기할 수 있도록 소유권을 맞춥니다. SQLite 저널 파일을 만들 수 있어야 하며 미디어 하위 디렉터리도 쓰기 가능해야 합니다.
4. 스키마, SQLite 무결성, 외래 키를 검사하고 Prisma 기준선을 등록한 뒤 BLEX 4 마이그레이션을 적용합니다.

   ```sh
   docker run --rm --user 1000:1000 \
     --mount "type=bind,source=$BLEX_DATA,target=/var/lib/blex" \
     -e DATABASE_URL=file:/var/lib/blex/db.sqlite3 blex4-migration sh -ec '
       node dist/src/compat/database-baseline.js /var/lib/blex/db.sqlite3 &&
       node node_modules/prisma/build/index.js migrate resolve --applied 0000_django_3x &&
       node node_modules/prisma/build/index.js migrate deploy'
   ```

   기준선 등록은 DB당 한 번입니다. `migrate resolve`까지 성공했다면 재시도할 때 `migrate deploy`부터 실행합니다. 이후 BLEX 4 업그레이드에는 기준선 검사를 반복하지 않고 `migrate deploy`를 사용합니다.

## Compose 설정과 실행

기존 `backend/.env`의 운영 설정을 저장소 루트 `.env`로 옮기고 다음 항목을 맞춥니다.

| 항목 | 변경 |
| --- | --- |
| `BLEX_DATA` | 위에서 이전한 데이터 디렉터리의 절대 경로 |
| `BLEX_PORT_MAPPING` | 컨테이너 포트를 `80`에서 `8040`으로 변경. 예: `127.0.0.1:20002:8040` |
| `BLEX_TRUSTED_PROXIES` | HTTPS 프록시의 IP 또는 CIDR 목록. 기존 `TRUSTED_PROXY_IPS`도 대체 값으로 읽음 |
| `SITE_URL`, `SECRET_KEY`, `CIPHER_KEY` | 기존 값 보존 |

```sh
docker compose up --build -d
docker compose logs blex
```

Compose의 사전 검사는 컨테이너 포트 불일치, 기존 DB를 두고 빈 데이터 디렉터리로 시작하는 경우, 쓰기 불가능한 미디어 디렉터리를 감지하면 중단합니다.

기존 글과 미디어 주소, 비밀번호·소셜 로그인, 2단계 인증, 글 저장, 관리자 설정을 확인합니다. 이전 버전으로 복구할 때는 전환 후 변경된 데이터의 처리 방법을 결정하고 전환 직전의 DB와 미디어 백업을 한 쌍으로 복구합니다.

## 백업의 공개 페이지 조회

서비스를 전환하기 전에 복제본의 공개 페이지를 읽기 전용으로 확인할 수 있습니다. 저장소 루트에서 실행합니다.

```sh
pnpm install
pnpm build
BLEX_V4_READ_ONLY=1 BLEX_V4_DB_PATH=/absolute/path/to/db.sqlite3 \
  BLEX_V4_MEDIA_PATH=/absolute/path/to/media pnpm start
```

`http://localhost:8040`에서 확인합니다. 이 모드는 로그인과 편집을 제공하지 않습니다.
