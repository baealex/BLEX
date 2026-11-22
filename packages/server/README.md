# BLEX 4 실행과 이관

Fastify가 React SSR, 정적 자산과 기존 HTTP API를 한 프로세스에서 제공합니다. Prisma가 SQLite 스키마 변경을 관리합니다. 기존 글과 미디어 URL을 그대로 사용할 수 있습니다.

각 주소는 첫 접속에 필요한 본문과 메타데이터를 서버에서 렌더링합니다. 접속 후에는 공통 React 앱의 라우터가 내부 화면을 전환하고, 로그인 폼과 글 편집기는 해당 화면에서 로드합니다.

## 로컬 실행

Node.js 24 이상에서 실행합니다.

```sh
cd packages/server
pnpm install --frozen-lockfile
pnpm test
```

백업 복제본의 공개 페이지를 조회할 수 있습니다.

```sh
BLEX_V4_READ_ONLY=1 BLEX_V4_DB_PATH=/absolute/path/to/db.sqlite3 pnpm start
```

브라우저에서 `http://localhost:8040`을 엽니다. 기존 미디어까지 조회하려면 `BLEX_V4_MEDIA_PATH`에 복제한 미디어 디렉터리를 지정합니다.
로컬에서 GIF 변환 또는 동영상 미리보기를 생성할 때는 `ffmpeg`가 PATH에 있어야 합니다.

## 로컬 이미지 빌드

저장소 루트에서 이미지 두 개를 만듭니다.

```sh
docker build --target migration -t blex4-migration .
docker build -t blex4 .
```

마이그레이션 이미지는 스키마 명령을 실행할 때 사용합니다. 서비스 이미지는 Node.js로 실행되고 미디어 처리를 위해 FFmpeg를 포함합니다. 데이터 디렉터리의 파일과 미디어를 컨테이너의 `node` 사용자(리눅스 UID 1000)가 읽고 쓸 수 있어야 합니다. SQLite 저널 파일도 같은 디렉터리에 작성됩니다.

4.0 릴리스가 나오면 아래 명령의 `blex4`와 `blex4-migration` 자리에 각각 `baealex/blex:4.0`과 `baealex/blex:4.0-migration`을 지정할 수 있습니다. 기존 `latest` 태그를 사용하는 3.x 인스턴스는 이관 절차를 거쳐 4.x 태그로 전환합니다.

## 빈 DB에 설치

```sh
export BLEX_DATA=/absolute/path/to/blex4-data
mkdir -p "$BLEX_DATA/media"
docker run --rm --user 1000:1000 --mount "type=bind,source=$BLEX_DATA,target=/var/lib/blex" \
  -e DATABASE_URL=file:/var/lib/blex/db.sqlite3 blex4-migration
```

환경 파일에 공개 주소 `SITE_URL`, `SECRET_KEY`, UTF-8 기준 32바이트 `CIPHER_KEY`를 설정합니다. 아래 명령으로 서비스를 실행한 뒤 로그에 표시되는 `/setup` 주소를 열어 첫 관리자를 만듭니다.

```sh
docker run --rm --env-file /absolute/path/to/blex4.env \
  --mount "type=bind,source=$BLEX_DATA,target=/var/lib/blex" \
  -p 127.0.0.1:8040:8040 blex4
```

## BLEX 3.x DB 이관

BLEX 3.14의 마지막 Django 마이그레이션은 `0070_author_subscription`입니다. BLEX 3.1 등 이전 버전은 3.14에서 이 단계까지 올린 뒤 같은 DB를 Prisma에 넘깁니다. 기존 비밀번호 해시와 소셜 계정 연결은 DB에 그대로 남습니다. 기존 3.x 브라우저 세션은 새로 로그인해야 합니다. 2단계 인증과 소셜 설정을 계속 사용하려면 `CIPHER_KEY`를 그대로 가져옵니다. 기존 `SECRET_KEY`와 `SITE_URL`도 환경 파일에 함께 보존합니다.

1. 기존 BLEX 서비스를 중지합니다. SQLite DB, 미디어, 환경 파일을 백업합니다. SQLite CLI의 `.backup` 또는 스냅샷을 사용해 DB에 반영된 모든 변경을 한 파일로 복사합니다. 원본은 보관하고 쓰기 가능한 복제본으로 아래 명령을 검증합니다.
2. 복제한 DB를 `$BLEX_DATA/db.sqlite3`, 미디어를 `$BLEX_DATA/media`에 둡니다. 기존 환경 파일을 지정해 3.14의 스키마를 적용합니다.

   ```sh
   docker run --rm --env-file /absolute/path/to/blex3.env \
     --mount "type=bind,source=$BLEX_DATA/db.sqlite3,target=/app/db.sqlite3" \
     --mount "type=bind,source=$BLEX_DATA/media,target=/app/resources/media" \
     --entrypoint python baealex/blex:3.14 manage.py migrate --noinput
   ```

3. SQLite 무결성과 최신 Django 스키마를 확인합니다. 검사가 성공하면 해당 스키마를 Prisma 기준선으로 등록하고 이후 마이그레이션을 적용합니다.

   ```sh
   docker run --rm --user 1000:1000 --mount "type=bind,source=$BLEX_DATA,target=/var/lib/blex" \
     -e DATABASE_URL=file:/var/lib/blex/db.sqlite3 blex4-migration sh -ec '\
       node dist/src/compat/database-baseline.js /var/lib/blex/db.sqlite3 && \
       node node_modules/prisma/build/index.js migrate resolve --applied 0000_django_3x && \
       node node_modules/prisma/build/index.js migrate deploy'
   ```

   `migrate resolve`까지 성공했다면 재시도할 때 `migrate deploy`부터 실행합니다. 기준선 등록은 DB당 한 번입니다. 이후 BLEX 4 업그레이드에서는 Prisma의 `migrate deploy`를 실행합니다.

4. BLEX 4를 실행하고 기존 글 주소, 로그인, 미디어, 관리자 설정을 확인합니다. 3.x로 되돌릴 때는 4.x에서 변경한 데이터의 처리 방법을 결정하고 전환 직전의 DB와 미디어 백업을 한 쌍으로 복구합니다.

기준선은 Django가 생성한 컬럼 타입과 외래 키를 보존합니다. Prisma 모델에서 `Unsupported`로 표시하는 기존 타입은 값을 바인딩하는 SQL을 사용해 접근합니다. 스키마 변경은 새 설치와 기존 DB 복제본에서 모두 검증합니다.
