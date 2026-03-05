---
title: 팀 회의
description: 구조화된 의사결정 회의 (선택지 → 트레이드오프 → 결정 → 기록)
labels: [meeting, decision, memory]
---

팀 페르소나 기반 구조화된 의사결정 회의를 진행합니다.

절차:
1. 상황 정의 → "뭘 결정해야 해?" — 결정이 필요한 맥락을 명확히 한다
2. 선택지 도출 → 페르소나들이 각자 관점에서 옵션을 제시한다
3. 트레이드오프 → 각 옵션의 장단점을 정리한다
4. 결정 → 사용자가 선택한다
5. ADR 기록 → D-chunk를 스키마 형식(`.conor/memory/_schema/decision.md`)으로 기록한다 (동일 주제 기존 chunk가 있으면 갱신 우선)
6. 인덱스 갱신 → chunk 생성/갱신이 있었을 때만 `npx team-conor summary` 를 실행하여 summary.md를 갱신한다
