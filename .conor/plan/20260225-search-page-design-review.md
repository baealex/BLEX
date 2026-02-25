# Search Results Design Review Plan (No Implementation)

## Goal
- Validate whether the search results page follows `docs/DESIGN_GUIDE.md` and identify concrete non-compliance items only.

## Scope
- Primary target: `backend/islands/apps/remotes/src/components/remotes/SearchPage/SearchPage.tsx`
- Context check: `backend/src/board/templates/board/search/search.html`
- Reference guide: `docs/DESIGN_GUIDE.md`

## Review Checklist
1. Token usage compliance
- Check for hardcoded color classes (`gray-*`, `black`, `white`) where semantic tokens should be used.
- Verify surface/content/line/action/state token consistency across all blocks.

2. Shape, spacing, motion consistency
- Validate radius scale usage (`rounded-md`~`rounded-2xl`) by component density/hierarchy.
- Validate spacing rhythm on 8px grid (`p-*`, `gap-*`) for section/list/card consistency.
- Check interaction transitions (`duration-150` baseline, meaningful active/hover feedback).

3. Search UX section-by-section
- Input/search bar: visual hierarchy, feedback states (idle/loading/clear/error).
- Result summary card: hierarchy clarity and typography balance.
- Result item cards: metadata readability, thumbnail fallback, emphasis/noise balance.
- Empty/error states: message clarity and design consistency with token system.
- Pagination: affordance clarity, active/disabled state distinction.

4. Mobile-first and touch requirements
- Confirm tap targets are at least 44x44 where expected.
- Review 375px layout behavior for overflow, truncation, spacing collapse, and readability.

5. Theme parity (light/dark)
- Ensure both themes preserve contrast/hierarchy and no one-off hardcoded styles break parity.

## Output Format (Review Only)
1. Findings first, ordered by severity (`high`, `medium`, `low`).
2. Each finding must include:
- exact file path + line reference
- violated design guide principle
- observable user impact
- fix direction (proposal only, no code change)
3. Include residual risks/testing gaps if visual runtime verification is unavailable.

## Non-Goals
- No implementation or refactor in this step.
- No API/state behavior changes unless directly tied to visual guideline interpretation.

## Known Issues (Initial Static Findings)
1. `high` 터치 타겟 최소 규격(44x44) 미달
- file/line: `backend/islands/apps/remotes/src/components/remotes/SearchPage/SearchPage.tsx:319`, `:350`, `:471`, `:481`, `:494`
- guide: `docs/DESIGN_GUIDE.md` 6장 `Touch Demands Substance` (minimum 44x44)
- impact: 모바일에서 오탭/미탭 확률이 올라가고, 특히 페이지네이션과 최근 검색어 삭제 조작이 불안정해짐.
- direction: 모바일 기준 최소 `min-h-11`/`h-11`(44px)로 상향하고 아이콘 버튼 hit area를 확장.

2. `high` 인터랙션의 active 피드백 누락
- file/line: `SearchPage.tsx:319`, `:344`, `:350`, `:471`, `:481`, `:494`
- guide: 4장 `The Action` + 6장 `Feedback is Respect` (`active:scale-95`, `active:bg-surface-subtle`)
- impact: 클릭/탭 시 눌림 감각이 없어 반응성이 떨어져 보이고, 디자인 시스템의 일관된 촉각 피드백이 깨짐.
- direction: 모든 주요 인터랙션 요소에 `active:*` 상태를 일관 적용.

3. `medium` 모션 토큰 사용 일관성 부족
- file/line: `SearchPage.tsx:300`, `:319`, `:350`, `:389`, `:471`, `:481`, `:494`
- guide: 1장 `Motion is Meaning` + 4장 `Duration 150ms`
- impact: 요소별 전환 속도/느낌이 달라져 화면 체감 완성도가 떨어질 수 있음.
- direction: `transition-*` 사용 지점에 `duration-150` 기준을 명시해 인터랙션 체감 통일.

4. `medium` 결과 카드 그림자 강도 가이드 대비 과함
- file/line: `SearchPage.tsx:389`
- guide: 4장 `The Card` / `Essential Tokens` (`shadow-subtle` 권장)
- impact: 목록 카드가 콘텐츠보다 시각적으로 튀어 “절제된 계층”보다 과장된 느낌을 줄 수 있음.
- direction: hover shadow 강도를 `shadow-subtle` 기반으로 맞추고 border 강조와 균형 조정.

5. `low` 상태 전환(로딩/결과/빈결과/에러)의 엔트런스 모션 부재
- file/line: `SearchPage.tsx:361-500` 범위의 조건 렌더링 블록
- guide: 1장 `Nothing just appears`
- impact: 상태가 바뀔 때 UI가 갑자기 바뀌어 덜 다듬어진 인상을 줄 수 있음.
- direction: 섹션 단위의 짧은 fade/slide 전환을 도입해 상태 전환 맥락을 전달.
