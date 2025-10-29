# Database Migration Guide: SQLite to PostgreSQL

## 개요

BLEX는 이제 SQLite와 PostgreSQL 두 가지 데이터베이스를 지원합니다. 이 가이드는 기존 SQLite 데이터베이스를 PostgreSQL로 마이그레이션하는 방법을 안내합니다.

## 왜 PostgreSQL인가?

### SQLite의 제한사항
- **동시성 제한**: 여러 사용자가 동시에 쓰기 작업 시 성능 저하
- **데이터 타입 검증 느슨함**: VARCHAR 길이 제한을 무시하여 예상치 못한 버그 발생 가능
- **확장성 부족**: 대용량 트래픽 처리에 한계

### PostgreSQL의 장점
- **엄격한 데이터 타입 검증**: VARCHAR(n) 제약을 엄격하게 적용하여 데이터 무결성 보장
- **뛰어난 동시성 처리**: MVCC(Multi-Version Concurrency Control)로 읽기/쓰기 충돌 최소화
- **확장성**: 인덱싱, 파티셔닝 등 대규모 데이터 처리에 최적화
- **고급 기능**: Full-text search, JSON 지원, 복제 및 백업

## 설정 방법

### 1. 환경 변수 설정

`.env` 파일에 다음 설정을 추가하세요:

```bash
# Database Configuration
DB_ENGINE=postgresql

# PostgreSQL Configuration
DB_NAME=blex
DB_USER=blex
DB_PASSWORD=your_secure_password_here
DB_HOST=postgres
DB_PORT=5432
```

### 2. Docker Compose로 시작

PostgreSQL 컨테이너가 자동으로 시작됩니다:

```bash
docker-compose up -d postgres
```

### 3. 데이터베이스 초기화

새로운 PostgreSQL 데이터베이스를 초기화합니다:

```bash
# 개발 환경
python backend/src/manage.py migrate

# Docker 환경
docker-compose exec backend python manage.py migrate
```

## 기존 SQLite 데이터 마이그레이션

### 방법 1: Django dumpdata/loaddata (권장)

가장 안전하고 권장되는 방법입니다:

```bash
# 1. SQLite에서 데이터 추출
cd backend/src
python manage.py dumpdata \
  --natural-foreign \
  --natural-primary \
  --exclude contenttypes \
  --exclude auth.permission \
  --indent 2 \
  > data_backup.json

# 2. .env에서 DB_ENGINE을 postgresql로 변경

# 3. PostgreSQL 데이터베이스 초기화
python manage.py migrate

# 4. 데이터 로드
python manage.py loaddata data_backup.json
```

### 방법 2: pgloader 사용

대용량 데이터의 경우 pgloader를 사용하면 더 빠릅니다:

```bash
# pgloader 설치 (Ubuntu/Debian)
sudo apt-get install pgloader

# 마이그레이션 실행
pgloader \
  backend/src/db.sqlite3 \
  postgresql://blex:your_password@localhost:5432/blex
```

### 방법 3: 수동 마이그레이션 스크립트

복잡한 데이터 변환이 필요한 경우 커스텀 스크립트를 작성할 수 있습니다:

```python
# backend/src/migrate_to_postgres.py
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'main.settings')
django.setup()

from django.contrib.auth.models import User
from board.models import Post, Comment, Profile
# ... 필요한 모델 import

# 마이그레이션 로직 작성
```

## 주의사항 및 모범 사례

### 1. 데이터 검증

마이그레이션 후 다음 사항을 반드시 확인하세요:

```bash
# 사용자 수 확인
python manage.py shell -c "from django.contrib.auth.models import User; print(User.objects.count())"

# 게시물 수 확인
python manage.py shell -c "from board.models import Post; print(Post.objects.count())"

# 댓글 수 확인
python manage.py shell -c "from board.models import Comment; print(Comment.objects.count())"
```

### 2. CharField 길이 제한 이슈

PostgreSQL은 VARCHAR 길이를 엄격하게 체크합니다. 기존 데이터에서 다음 필드의 길이를 확인하세요:

- `Post.title` (max_length=65)
- `Post.url` (max_length=65)
- `Profile.bio` (max_length=500)
- `Comment.text_md` (max_length=500)

길이를 초과하는 데이터가 있다면 마이그레이션 전에 정리가 필요합니다:

```python
# 길이 초과 데이터 확인
from board.models import Post
long_titles = Post.objects.filter(title__length__gt=65)
print(f"제목이 긴 게시물: {long_titles.count()}개")

for post in long_titles:
    print(f"ID: {post.id}, 길이: {len(post.title)}, 제목: {post.title}")
```

### 3. 백업

마이그레이션 전에 반드시 백업하세요:

```bash
# SQLite 백업
cp backend/src/db.sqlite3 backend/src/db.sqlite3.backup

# 미디어 파일 백업
tar -czf media_backup.tar.gz backend/src/resources/media/
```

### 4. 성능 최적화

PostgreSQL은 정기적인 VACUUM과 ANALYZE가 필요합니다:

```bash
# Docker에서 실행
docker-compose exec postgres psql -U blex -c "VACUUM ANALYZE;"
```

## 트러블슈팅

### 문제: 마이그레이션 중 "value too long for type character varying(N)" 에러

**원인**: SQLite에서는 허용되던 긴 문자열이 PostgreSQL에서 거부됨

**해결 방법**:
```python
# 문제가 되는 필드의 데이터 정리
from board.models import Post

for post in Post.objects.all():
    if len(post.title) > 65:
        post.title = post.title[:62] + '...'
        post.save()
```

### 문제: "duplicate key value violates unique constraint" 에러

**원인**: 시퀀스가 올바르게 초기화되지 않음

**해결 방법**:
```bash
# PostgreSQL 시퀀스 재설정
docker-compose exec postgres psql -U blex -d blex -c "
SELECT setval(pg_get_serial_sequence('board_post', 'id'),
    COALESCE(MAX(id), 1)) FROM board_post;
"
```

### 문제: 연결 타임아웃

**원인**: PostgreSQL이 준비되기 전에 Django가 연결 시도

**해결 방법**:
Docker Compose의 healthcheck가 자동으로 처리하지만, 수동으로 확인하려면:

```bash
# PostgreSQL 준비 상태 확인
docker-compose exec postgres pg_isready -U blex
```

## 성능 비교

| 항목 | SQLite | PostgreSQL |
|------|--------|-----------|
| 동시 쓰기 | 제한적 | 우수 |
| 읽기 성능 | 우수 | 매우 우수 |
| 데이터 무결성 | 보통 | 높음 |
| 확장성 | 낮음 | 매우 높음 |
| 백업/복구 | 간단 | 고급 기능 |

## 롤백 방법

문제가 발생하면 SQLite로 롤백할 수 있습니다:

```bash
# 1. .env에서 DB_ENGINE을 sqlite3로 변경
DB_ENGINE=sqlite3

# 2. 백업한 SQLite 파일 복원
cp backend/src/db.sqlite3.backup backend/src/db.sqlite3

# 3. 서비스 재시작
docker-compose restart backend
```

## 추가 리소스

- [Django Database Documentation](https://docs.djangoproject.com/en/5.1/ref/databases/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [pgloader Documentation](https://pgloader.readthedocs.io/)

## 지원

문제가 발생하면 GitHub Issues에 보고해주세요:
- 에러 메시지 전체
- 사용 중인 환경 (Docker/로컬)
- 마이그레이션 단계

---

**마지막 업데이트**: 2025-10-29
