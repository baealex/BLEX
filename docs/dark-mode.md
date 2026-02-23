# BLEX Dark Mode Master Plan

## 1. 목표

BLEX 전체 UI(SSR 템플릿 + Islands React + UI 패키지 + Editor)에 대해 다음을 동시에 만족하는 다크모드를 정식 도입한다.

1. 색상 체계의 단일 진실 원천(Single Source of Truth) 확보
2. Tailwind 클래스에서 의미 기반 토큰(`surface`, `content`, `line`, `action`) 사용
3. 라이트/다크/시스템 모드 지원 + 사용자 선택 저장
4. 접근성(명도 대비), 일관성, 회귀 방지 체계 확보

---

## 2. 현재 상태 진단 (2026-02-23 기준)

### 2.1 핵심 진단

1. 다크모드 전환 메커니즘 부재
   - `.dark`, `[data-theme]`, `prefers-color-scheme` 기반 토글 로직이 없음
2. 색상 토큰 정의는 일부 존재
   - `backend/islands/apps/remotes/styles/variables.css`
   - `backend/islands/apps/remotes/styles/tailwind.css`
3. 실제 컴포넌트는 하드코딩된 Tailwind 회색 계열 의존이 큼
   - `bg-white`, `text-gray-900`, `border-gray-200`, `ring-gray-900/5` 등

### 2.2 마이그레이션 볼륨(빠른 인벤토리)

1. Islands/React에서 색상 하드코딩 라인: 약 642
2. Django template HTML에서 색상 하드코딩 라인: 약 305
3. 영향 파일 수(대략)
   - Islands + packages: 약 85개
   - Templates: 약 27개
4. 다크모드 관련 전역 훅 존재 여부: 0개

### 2.3 우선 영향 영역

1. `backend/islands/packages/ui/src/components/*` (공용 컴포넌트)
2. `backend/islands/apps/remotes/src/components/remotes/SettingsApp/*`
3. `backend/src/board/templates/components/header.html`
4. `backend/src/board/templates/board/posts/post_detail.html`
5. `backend/src/board/templates/board/author/*`

### 2.4 진행 현황 업데이트 (2026-02-23)

완료된 항목:

1. cookie(`blex_theme`) 기반 SSR 테마 주입 + FOUC 방지 부트스트랩 적용
2. 헤더 토글 및 런타임 테마 유틸(`data-theme`, `data-theme-preference`) 적용
3. `@blex/ui` 주요 컴포넌트 토큰 기반 치환 완료
4. Templates 주요 화면 토큰 기반 치환 완료
5. Remotes(App) 하드코딩 색상 클래스 치환 완료
   - `backend/islands/apps/remotes/src`: 하드코딩 컬러 클래스 스캔 0건
   - `backend/islands/packages/ui/src`: 하드코딩 컬러 클래스 스캔 0건
   - `backend/src/board/templates`: 하드코딩 컬러 클래스 스캔 0건
6. hCaptcha 테마 하드코딩 제거
   - 현재 resolved theme(`light|dark`)로 동기화

잔여 항목:

1. Editor 하이라이트/콘텐츠 면 전용 다크 튜닝(Phase 5)
2. server test(`npm run server:test`) 포함 최종 품질 게이트(Phase 7)
3. PR 분할 전략 기준으로 변경셋 분리 및 스크린샷 QA

---

## 3. 설계 원칙

1. **의미 토큰 우선**: 색 의미(배경/텍스트/보더/상태)로 표현하고 실제 색값은 변수에서만 관리
2. **점진적 치환 금지**: 화면별로 일부만 다크 대응하는 상태를 오래 유지하지 않음
3. **공용 계층 선행**: `@blex/ui`와 전역 스타일을 먼저 개편 후 앱/템플릿 순으로 전환
4. **접근성 하한선 명시**: 본문 텍스트 대비 최소 WCAG AA(4.5:1) 목표
5. **토큰 이탈 차단**: 신규 코드에서 `gray/white/black` 직접 색상 클래스 사용 금지 룰 추가

---

## 4. 타깃 아키텍처

### 4.1 Theme Source of Truth

1. HTML 루트에 `data-theme` 사용
   - 예: `<html lang="ko" data-theme="light">`
2. 허용 모드
   - `light`
   - `dark`
   - `system` (저장값, 런타임엔 `light|dark`로 적용)
3. 우선순위
   - 사용자 저장값(cookie: `blex_theme`) > 시스템 선호(`prefers-color-scheme`) > 기본 라이트
   - 서버 렌더 단계에서 `request.COOKIES.blex_theme`를 읽어 `html[data-theme]`를 먼저 세팅

### 4.2 CSS 변수 레이어

1. `:root` = 라이트 토큰
2. `[data-theme="dark"]` = 다크 토큰 오버라이드
3. 토큰 네이밍
   - `--color-surface-*`
   - `--color-content-*`
   - `--color-line-*`
   - `--color-action-*`
   - `--color-state-*` (success/warning/danger/info)
   - `--shadow-*`
   - `--color-dim-*`, `--color-frosted-*`, `--color-glass-*`

### 4.3 Tailwind Theme Mapping

`backend/islands/apps/remotes/styles/tailwind.css`의 `@theme`에 의미 토큰을 모두 매핑한다.

1. Surface
   - `--color-surface`
   - `--color-surface-page`
   - `--color-surface-subtle`
   - `--color-surface-elevated`
2. Content
   - `--color-content`
   - `--color-content-secondary`
   - `--color-content-hint`
   - `--color-content-inverted`
3. Line
   - `--color-line`
   - `--color-line-light`
   - `--color-line-strong`
4. Action
   - `--color-action`
   - `--color-action-hover`
   - `--color-action-pressed`
5. State
   - `--color-success-*`, `--color-warning-*`, `--color-danger-*`

### 4.4 런타임 테마 유틸

신규 스크립트(`backend/islands/apps/remotes/src/scripts/theme.ts`)에서 다음 제공:

1. `getStoredTheme(): 'light' | 'dark' | 'system'`
2. `resolveTheme(storedTheme): 'light' | 'dark'`
3. `applyTheme(theme)`
4. `setTheme(theme)`
5. `subscribeSystemThemeChange(callback)`

Django 템플릿 초기 페인트 깜빡임 방지용 인라인 bootstrap script를 `base.html` head에 추가한다.

---

## 5. 구현 단계 (상세)

### Phase 0. 사전 준비 (0.5일)

### 작업

1. 다크모드 전용 브랜치 생성
   - 권장: `feat/theme-dark-mode-foundation`
2. 기준 스냅샷 확보
   - 주요 페이지 스크린샷(light)
3. 영향 파일 인벤토리 고정
   - 검색 커맨드 결과를 문서화

### 산출물

1. 기준 페이지 목록
2. 리스크 로그 초기본
3. 마이그레이션 순서 확정

### 완료 기준

1. “무엇을 언제 바꿀지”가 파일 단위로 확정

---

### Phase 1. 토큰/테마 기반 구축 (1.0일)

### 대상 파일

1. `backend/islands/apps/remotes/styles/variables.css`
2. `backend/islands/apps/remotes/styles/tailwind.css`
3. `backend/islands/apps/remotes/styles/main.scss`
4. `backend/src/board/templates/board/base.html`
5. (신규) `backend/islands/apps/remotes/src/scripts/theme.ts`

### 작업

1. `variables.css`를 semantic token 중심으로 확장
2. `[data-theme="dark"]` 블록 추가
3. `frosted/glass/dim/shadow` 토큰을 라이트/다크 분리
4. `tailwind.css` `@theme`와 `@utility`를 토큰 기반으로 재정의
5. `base.html`에 초기 테마 적용 스크립트 삽입
6. `<html>` 또는 `<body>`에 theme attribute 반영 지점 확정
7. `meta[name="theme-color"]`를 활성 테마와 동기화

### 완료 기준

1. 토큰만 변경해도 공용 유틸의 배경/보더/글래스/오버레이가 라이트/다크 전환
2. 초기 로드 시 테마 깜빡임(FOUC) 없음

---

### Phase 2. 공용 UI 패키지 다크 대응 (1.5일)

### 대상 디렉토리

1. `backend/islands/packages/ui/src/components/`

### 우선 컴포넌트

1. `Button.tsx`
2. `Input.tsx`
3. `Card.tsx`
4. `Modal.tsx`
5. `Dropdown.tsx`
6. `Select.tsx`
7. `Tabs/index.tsx`
8. `Tooltip.tsx`
9. `Checkbox.tsx`
10. `Toggle.tsx`
11. `Alert.tsx`
12. `IconButton.tsx`
13. `LoadingState.tsx`

### 작업

1. 하드코딩 색상 클래스 제거
   - 예: `bg-white` -> `bg-surface`
   - 예: `text-gray-900` -> `text-content`
   - 예: `border-gray-200` -> `border-line`
2. variant 설계 재검증
   - `primary/secondary/danger/ghost`의 다크 대비 보장
3. focus/hover/active 상태 대비 점검
4. skeleton/placeholder 색상 토큰화

### 완료 기준

1. UI 패키지 단독으로 다크모드에서 시인성/대비/상태 변화가 유지
2. 신규 페이지가 UI 패키지만 사용해도 다크 자연 동작

---

### Phase 3. Islands App(Remotes) 전환 (2.0일)

### 우선 순위

1. SettingsApp 전체
2. Auth(Login/Signup/LoginPrompt/SocialLogin)
3. PostEditor / Comments / RelatedPosts / SearchPage

### 중점 파일 예시

1. `backend/islands/apps/remotes/src/styles/settingsStyles.ts`
2. `backend/islands/apps/remotes/src/components/remotes/SettingsApp/**`
3. `backend/islands/apps/remotes/src/components/remotes/Login/**`
4. `backend/islands/apps/remotes/src/components/remotes/Signup/Signup.tsx`
5. `backend/islands/apps/remotes/src/components/remotes/PostEditor/**`
6. `backend/islands/apps/remotes/src/components/remotes/Comments/**`

### 작업

1. 공용 스타일 상수(`settingsStyles.ts`)를 토큰 기반으로 재작성
2. 페이지별 하드코딩 색상 클래스 치환
3. 하드코딩 아이콘/배지 색을 state token으로 이동
4. 캡챠 테마 동기화
   - `theme: 'light'` 하드코딩 제거
   - 현재 resolved theme에 따라 `light|dark` 전달

### 완료 기준

1. Remotes 주요 UX(설정, 편집, 로그인, 댓글)가 라이트/다크 모두 사용 가능
2. 기능/레이아웃 회귀 없음

---

### Phase 4. Django Templates + SCSS 전환 (2.0일)

### 대상

1. `backend/src/board/templates/components/*`
2. `backend/src/board/templates/board/*`
3. `backend/src/board/templates/components/*.scss`

### 우선 템플릿

1. `components/header.html`
2. `components/footer.html`
3. `board/base.html`
4. `board/posts/post_detail.html`
5. `board/author/*`
6. `board/series/series_detail.html`
7. `components/post_card.html`
8. `components/quick_search.html`
9. `components/notice_carousel.html`
10. `components/toc.html`

### 작업

1. 템플릿 Tailwind 클래스 토큰 치환
2. SCSS 직접 색상(`white/#000/rgb`) 제거 후 CSS 변수 사용
3. SSR 화면(초기 렌더)에서 테마 일관성 유지
4. sticky/floating/glass 컴포넌트 대비 재조정

### 완료 기준

1. 템플릿 기반 주요 페이지에서 다크 UI 붕괴 없음
2. 가독성(본문/메타/보조 텍스트) 확보

---

### Phase 5. Editor/Code Block/콘텐츠 면 조정 (0.75일)

### 대상

1. `backend/islands/packages/editor/styles/highlight-theme.scss`
2. `backend/islands/apps/remotes/styles/post.scss`
3. `backend/islands/apps/remotes/src/scripts/syntax-highlighting.ts`

### 작업

1. 코드 하이라이트 라이트/다크 테마 분리
2. 본문 콘텐츠 영역(`prose`) 토큰 매핑
3. 인용/표/코드블록/링크/캡션 대비 점검

### 완료 기준

1. 포스트 읽기 경험에서 다크모드 가독성 문제 없음

---

### Phase 6. 토글 UI + 설정 저장 + 시스템 연동 (0.75일)

### 작업

1. 헤더 또는 사용자 설정에 테마 토글 추가
2. 저장소
   - 1차: cookie(`blex_theme`, `Path=/`, `SameSite=Lax`, 1년)
   - 2차(선택): 서버 사용자 설정 API 동기화
3. 시스템 모드 반영
   - OS 테마 변경 시 `system` 선택 상태면 즉시 반영
4. 접근성
   - 토글 버튼 `aria-label`, 현재 상태 노출

### 완료 기준

1. 사용자가 라이트/다크/시스템을 명확히 선택 가능
2. 새로고침/재방문 시 선택 유지

---

### Phase 7. 품질 게이트/배포 (0.5일)

### 검증

1. 정적 품질
   - `npm run islands:lint`
   - `npm run islands:type-check`
2. 서버 테스트
   - `npm run server:test`
3. 수동 시나리오
   - 로그인/회원가입
   - 포스트 열람/댓글/검색
   - 설정앱 전 메뉴
   - 에러 페이지(404/403)
4. 반응형
   - 375px / 768px / 1440px
5. 브라우저
   - Chrome/Safari/Firefox 최신

### 완료 기준

1. P0 회귀 0건
2. 접근성/가독성 blocker 0건

---

## 6. PR 분할 전략

큰 덩어리 1PR 금지. 아래 순서로 나눈다.

1. PR-1 Foundation
   - tokens + theme bootstrap + base wiring
2. PR-2 UI Package
   - `@blex/ui` 전체
3. PR-3 Remotes (Settings/Auth)
4. PR-4 Remotes (Editor/Comments/Search/Related)
5. PR-5 Templates + SCSS
6. PR-6 QA Fix + lint rules + docs finalize

각 PR 조건:

1. Scope가 명확해야 함
2. 스크린샷(라이트/다크/모바일) 필수
3. 변경 파일군이 역할별로 분리돼야 함

---

## 7. 코드 규칙 추가 (다크모드 완료 후)

### 7.1 ESLint/리뷰 규칙

1. JSX className에서 직접 색상 클래스 사용 제한
   - 금지 예: `text-gray-600`, `bg-white`, `border-gray-200`
2. 예외 허용
   - 상태색(danger/warning/success)은 토큰 클래스로만 허용

### 7.2 코드리뷰 체크리스트

1. 새 UI가 토큰 기반인가?
2. hover/focus/active가 다크에서도 동작하는가?
3. placeholder/skeleton/tooltips까지 대응됐는가?

---

## 8. 리스크 및 대응

1. 리스크: 중간 단계에서 라이트/다크 혼재
   - 대응: PR 단위별 “화면 완결 범위” 설정, 반쯤 치환 상태 병합 금지
2. 리스크: 템플릿과 React 스타일 체계 충돌
   - 대응: 의미 토큰 이름 공통화, `variables.css` 단일 참조
3. 리스크: 글래스/블러 계열이 다크에서 탁해짐
   - 대응: dark 전용 alpha/shadow 재튜닝
4. 리스크: 캡챠/외부 위젯 색상 불일치
   - 대응: theme bridge 함수로 동기화
5. 리스크: 회귀 탐지 누락
   - 대응: 핵심 페이지 스냅샷 비교(라이트/다크)

---

## 9. 일정 및 공수

1인 기준 예상:

1. 최소 완료(핵심 화면): 5~6 작업일
2. 온전 완료(전체 주요 화면 + QA 안정화): 7~8 작업일
3. 버퍼 포함 권장: 8~10 작업일

2인 병렬 기준:

1. 3~5 작업일 (공용/UI 담당 + 템플릿/기능 담당 분할)

---

## 10. Definition of Done

아래를 모두 만족해야 “완료”로 본다.

1. 라이트/다크/시스템 선택 가능
2. 새로고침/재방문 시 모드 유지
3. 핵심 페이지(포스트, 저자, 설정, 인증, 검색) 다크 UI 정상
4. 공용 UI 컴포넌트 토큰 기반 전환 완료
5. 하드코딩 색상 클래스 신규 유입 방지 룰 적용
6. lint/type-check/test 통과
7. 문서(`docs/dark-mode.md`)와 실제 구현 상태 일치

---

## 11. 착수 순서(실행 체크리스트)

1. Phase 0 완료
2. PR-1 생성 (Foundation)
3. PR-2 생성 (UI package)
4. PR-3/4 생성 (Remotes)
5. PR-5 생성 (Templates)
6. PR-6 생성 (QA + guardrail)
7. 최종 회귀 점검 후 main 반영

---

## 12. 부록: 권장 토큰 치환 매핑

대표 치환 가이드:

1. `bg-white` -> `bg-surface`
2. `bg-gray-50` -> `bg-surface-subtle`
3. `text-gray-900` -> `text-content`
4. `text-gray-600` -> `text-content-secondary`
5. `text-gray-400` -> `text-content-hint`
6. `border-gray-200` -> `border-line`
7. `ring-gray-900/5` -> `ring-line/50` 또는 토큰 유틸
8. `bg-black text-white` -> `bg-action text-content-inverted`

주의:

1. 상태색(red/yellow/green)은 의미 없는 raw shade를 직접 쓰지 않고 state token으로 통일
2. focus ring은 라이트/다크 각각 대비가 확보되는 토큰값 사용
