# BLEX Design Guide

> 콘텐츠가 주인공이고, UI는 보이지 않는다.

## 핵심 철학

### 1. 미니멀리즘
- 회색 중심 팔레트로 콘텐츠에 집중
- 장식 없이 기능만 표현
- 여백으로 숨 쉬는 레이아웃

### 2. 명확한 상호작용
- 클릭 가능한 것은 버튼처럼 보여야 함 (아이콘 + 배경)
- 모든 액션에 즉각적인 피드백 (호버, 로딩)
- 비활성 상태는 회색으로 명확히 표현

### 3. 일관성
- 같은 패턴 반복으로 학습 비용 제로
- 8px 기반 간격, rounded-lg/xl 통일
- 150-200ms transition 일관 적용

---

## 색상 시스템

```css
/* 메인 */
gray-900  → 액션 버튼, 주요 텍스트
gray-100  → 보조 버튼 배경
white     → 카드 배경

/* 텍스트 계층 */
gray-900  → Primary
gray-600  → Secondary
gray-400  → Disabled

/* 강조 */
red-50/600 → 삭제/경고만 사용
```

**규칙**:
- Primary 버튼: `bg-gray-900 text-white`
- Secondary 버튼: `bg-gray-100 text-gray-700`
- 삭제 버튼: `bg-red-50 text-red-600`

---

## 간격 (8px 기반)

```tsx
// 버튼 패딩
px-3 py-1.5  // 소형 아이콘 버튼
px-5 py-2.5  // 중형 일반 버튼
px-6 py-2.5  // 대형 Primary 버튼

// 카드/폼 패딩
p-5 sm:p-6   // 모바일→데스크톱

// 요소 간 간격
space-y-2    // 밀접 (8px)
space-y-4    // 기본 (16px)
space-y-8    // 섹션 (32px)
```

---

## 반경

```tsx
rounded-lg   // 버튼 (8px)
rounded-xl   // 입력 필드, 카드 (12px)
rounded-2xl  // 큰 카드 (16px)
rounded-full // 프로필 이미지
```

---

## 상호작용

### Transition 속도
```css
duration-150  → 버튼 호버
duration-200  → 카드 호버
duration-500  → 이미지 줌
```

### 호버 효과
```tsx
// 버튼
bg-gray-900 hover:bg-gray-800

// 카드
bg-white hover:bg-gray-50/50

// 프로필
hover:scale-105
```

### 포커스
```tsx
focus:border-gray-900
focus:ring-2 focus:ring-gray-900/10
focus:outline-none
```

### 로딩
```tsx
{isSubmitting ? (
  <span className="inline-flex items-center gap-2">
    <Spinner />
    작성 중...
  </span>
) : '작성'}
```

---

## 컴포넌트 패턴

### Primary Button
```tsx
<button className="
  px-6 py-2.5 rounded-lg
  bg-gray-900 hover:bg-gray-800
  text-white font-semibold
  transition-all duration-150
  shadow-sm hover:shadow-md
  disabled:bg-gray-200 disabled:cursor-not-allowed
">
  작성
</button>
```

### Secondary Button (Icon)
```tsx
<button className="
  inline-flex items-center gap-1.5
  px-3 py-1.5 rounded-lg
  bg-gray-100 hover:bg-gray-200
  text-gray-700 hover:text-gray-900
  font-semibold
  transition-all duration-150
">
  <Icon className="w-4 h-4" />
  답글
</button>
```

### Textarea
```tsx
<textarea className="
  w-full p-5
  border-2 border-gray-200
  focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10
  rounded-xl resize-none
  text-sm leading-relaxed
  transition-all duration-150
" />
```

### Card
```tsx
<article className="
  p-6 bg-white
  rounded-xl ring-1 ring-gray-900/5
  hover:bg-gray-50/50
  transition-colors duration-200
">
```

### Avatar (Profile Image)
```tsx
<img className="
  w-11 h-11 rounded-full
  ring-2 ring-gray-100
  group-hover:ring-gray-300
  hover:scale-105
  transition-all duration-200
" />
```

---

## 실전 예시

### 댓글 시스템

```tsx
// 댓글 카드
<article className="
  py-6 px-4 sm:px-6
  bg-white hover:bg-gray-50/50
  rounded-xl ring-1 ring-gray-900/5
  transition-colors duration-200
">

// 답글 계층 표현 (왼쪽 보더)
{isReply && "ml-6 sm:ml-14 border-l-2 border-gray-200 pl-6 sm:pl-8"}

// 좋아요 버튼 (활성화 시 검은색)
<button className={`
  inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
  font-semibold transition-all duration-150
  ${isLiked
    ? 'bg-gray-900 text-white hover:bg-gray-800'
    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}
`}>
  <ThumbsUpIcon className="w-4 h-4" />
  {countLikes > 0 && countLikes}
</button>
```

---

## 반응형

```tsx
// Mobile First
text-2xl sm:text-3xl lg:text-4xl  // 타이포
p-4 md:p-6 lg:p-8                 // 간격
ml-6 sm:ml-14                     // 답글 들여쓰기
```

---

## 접근성

```tsx
// 필수 ARIA
<button aria-label="좋아요" aria-pressed={isLiked}>
<time dateTime={isoDate}>{displayDate}</time>
<article aria-label={`${author}의 댓글`}>

// 키보드 접근 (div 금지)
<button> ✅
<a href> ✅
<div onClick> ❌

// 색상 대비 (WCAG AA)
gray-900/600/500 이상 ✅
gray-400/300 이하 ❌
```

---

## 체크리스트

새 컴포넌트 작성 시:
- [ ] 색상: gray-900/100 사용
- [ ] 간격: 8px 배수 (`space-y-4`, `p-5`)
- [ ] 반경: `rounded-lg/xl` 일관
- [ ] 호버: 색상/스케일 변화 있음
- [ ] 포커스: `focus:ring-2` 있음
- [ ] 로딩: 스피너 + 텍스트 표시
- [ ] Disabled: 회색 처리
- [ ] ARIA: `aria-label` 추가
- [ ] 반응형: `sm:` 브레이크포인트
