# 마크다운 헤딩 태그 검증 및 재렌더링 유틸리티

## 개요

이 유틸리티는 데이터베이스의 모든 마크다운 콘텐츠를 검증하고, 헤딩 태그가 잘못된 경우 자동으로 재렌더링합니다.

## 검증 항목

다음과 같은 경우 재렌더링이 필요하다고 판단합니다:

1. **헤딩 태그 ID 누락**: `<h2>`, `<h4>` 등의 헤딩 태그에 `id` 속성이 없는 경우
2. **잘못된 헤딩 레벨**: `<h1>`, `<h3>`, `<h5>` 같은 홀수 레벨 헤딩이 있는 경우
   - 현재 마크다운 렌더러는 `h1` → `h2`, `h3` → `h4`, `h5` → `h6`으로 변환합니다
3. **빈 HTML**: `text_md`는 있지만 `text_html`이 비어있는 경우
4. **렌더링 불일치**: `text_md`를 다시 렌더링했을 때 현재 `text_html`과 다른 경우

## 처리 대상 모델

- **Comment**: 댓글의 `text_md` / `text_html`
- **PostContent**: 게시글 내용의 `text_md` / `text_html`
- **Profile**: 프로필 소개의 `about_md` / `about_html`
- **Series**: 시리즈 설명의 `text_md` / `text_html`

## 사용법

### 1. Dry-run 모드 (권장)

실제 변경 없이 어떤 항목들이 재렌더링이 필요한지만 확인합니다:

```bash
cd backend/src
python utility/validate_and_rerender_markdown.py --dry-run
```

또는 플래그 없이 실행 (기본값이 dry-run):

```bash
python utility/validate_and_rerender_markdown.py
```

### 2. 실제 재렌더링 수행

데이터베이스에 변경사항을 저장하려면 `--execute` 플래그를 사용합니다:

```bash
python utility/validate_and_rerender_markdown.py --execute
```

⚠️ **주의**: `--execute` 모드는 데이터베이스를 직접 수정합니다. 먼저 dry-run으로 확인 후 실행하세요.

### 3. 특정 모델만 처리

특정 모델만 처리하려면 `--models` 옵션을 사용합니다:

```bash
# Comment만 처리
python utility/validate_and_rerender_markdown.py --dry-run --models Comment

# PostContent와 Comment 처리
python utility/validate_and_rerender_markdown.py --dry-run --models PostContent Comment

# 모든 모델 처리 (기본값)
python utility/validate_and_rerender_markdown.py --dry-run --models all
```

### 4. 도움말 보기

```bash
python utility/validate_and_rerender_markdown.py --help
```

## 출력 예시

### Dry-run 모드

```
================================================================================
DRY-RUN 모드: 실제 변경사항은 저장되지 않습니다
실제 변경을 수행하려면 --execute 플래그를 사용하세요
================================================================================

================================================================================
Comment 처리 중...
================================================================================
총 150개의 Comment을(를) 검사합니다...

[1/150] Comment #12 - 재렌더링 필요
  - 홀수 레벨 헤딩 발견: h3
  - ID 누락된 헤딩: h3
  - 렌더링 결과가 현재 HTML과 다름
  ⚠ DRY-RUN: 변경사항이 저장되지 않았습니다

[5/150] Comment #45 - 재렌더링 필요
  - 렌더링 결과가 현재 HTML과 다름
  ⚠ DRY-RUN: 변경사항이 저장되지 않았습니다

Comment 처리 완료:
  - 전체: 150개
  - 재렌더링 필요: 2개

================================================================================
전체 처리 요약
================================================================================
전체: 150개
재렌더링 필요: 2개

실제 재렌더링을 수행하려면 다음 명령어를 실행하세요:
  python validate_and_rerender_markdown.py --execute
```

### Execute 모드

```
================================================================================
⚠️  실행 모드: 변경사항이 데이터베이스에 저장됩니다
================================================================================

[1/150] Comment #12 - 재렌더링 필요
  - 홀수 레벨 헤딩 발견: h3
  - ID 누락된 헤딩: h3
  - 렌더링 결과가 현재 HTML과 다름
  ✓ 재렌더링 완료

...

================================================================================
전체 처리 요약
================================================================================
전체: 150개
재렌더링 필요: 2개

✓ 2개의 항목이 성공적으로 재렌더링되었습니다
```

## 실행 전 체크리스트

1. ✅ 데이터베이스 백업 완료
2. ✅ 먼저 dry-run 모드로 확인
3. ✅ 필요한 Python 패키지 설치 확인 (Django, markdown, pymdown-extensions)
4. ✅ Django 설정 정상 작동 확인

## 문제 해결

### ModuleNotFoundError: No module named 'django'

필요한 패키지를 설치하세요:

```bash
cd backend/src
pip install -r requirements.txt
```

또는 Docker 환경을 사용하는 경우:

```bash
docker-compose exec backend python /app/utility/validate_and_rerender_markdown.py --dry-run
```

### 경로 오류

스크립트는 `backend/src` 디렉토리에서 실행되어야 합니다:

```bash
cd /path/to/BLEX/backend/src
python utility/validate_and_rerender_markdown.py --dry-run
```

## 추가 정보

- 스크립트는 각 모델 인스턴스를 개별적으로 처리하므로 안전합니다
- 재렌더링 시 `update_fields`를 사용하여 필요한 필드만 업데이트합니다
- HTML 비교 시 공백 차이는 무시합니다 (정규화 후 비교)
- 대량의 데이터가 있는 경우 처리 시간이 오래 걸릴 수 있습니다

## 기술적 세부사항

### 헤딩 레벨 변환 로직

현재 마크다운 렌더러(`modules/markdown.py`)의 `HeaderHashTreeprocessor`는 다음과 같이 헤딩 레벨을 조정합니다:

```python
level = int(elem.tag[1])  # h1 -> 1, h2 -> 2, ...
if level % 2 == 1:
    level += 1  # 홀수 레벨은 +1
    elem.tag = f'h{level}'
```

결과:
- `# 제목` (h1) → `<h2 id="...">제목</h2>`
- `## 제목` (h2) → `<h2 id="...">제목</h2>`
- `### 제목` (h3) → `<h4 id="...">제목</h4>`
- `#### 제목` (h4) → `<h4 id="...">제목</h4>`
- `##### 제목` (h5) → `<h6 id="...">제목</h6>`
- `###### 제목` (h6) → `<h6 id="...">제목</h6>`

### ID 생성 규칙

헤딩 ID는 다음 규칙으로 생성됩니다:

1. 헤딩 텍스트를 `slugify_unicode()`로 변환
2. 최대 25자로 제한
3. 중복 ID는 `-1`, `-2` 등의 접미사 추가
4. 텍스트가 없으면 `header` 사용

예시:
- `<h2>Hello World</h2>` → `<h2 id="hello-world">Hello World</h2>`
- `<h2>안녕하세요</h2>` → `<h2 id="안녕하세요">안녕하세요</h2>`
- `<h2>Hello World</h2>` (중복) → `<h2 id="hello-world-1">Hello World</h2>`
