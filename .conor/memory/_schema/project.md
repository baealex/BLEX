# Project Chunk 스키마

<!--
이 파일은 P(프로젝트) 타입 chunk의 작성 형식을 정의합니다.
프로젝트 구조, 빌드, 배포, 환경 설정 등의 정보를 기록합니다.
-->

## 언제 작성하는가

- 프로젝트 구조, 빌드, 배포 관련 정보가 확인되었을 때
- 개발 환경 설정이나 인프라 구성이 변경되었을 때
- 외부 서비스 연동 정보가 추가되었을 때
- 프로젝트 컨벤션이나 규칙이 정해졌을 때

## 파일명 규칙

`P-{YYYYMMDD}-{영문slug}.md`

- 예: `P-20250207-build-pipeline.md`
- slug는 프로젝트 정보를 2~4단어 영문으로 요약

## 작성 규칙

- 하나의 항목 = 하나의 chunk (여러 주제를 섞지 않음)
- 각 필드는 1~3줄로 핵심만 작성
- 전체 10줄 이내
- 참고 링크/경로는 해당 시에만 작성

## 템플릿

```template
---
type: project
date: YYYY-MM-DD
tags: [태그1, 태그2]
refs: []
---
**항목**: 무엇에 대한 정보인지 (1줄)
**내용**: 구체적인 내용 (2-3줄)
**참고**: 관련 문서, 경로, 링크 (해당 시)
```

## 예시

```markdown
---
type: project
date: 2025-02-07
tags: [build, deployment]
refs: []
---
**항목**: GitHub Actions CI/CD 파이프라인 구성
**내용**: main 브랜치 push 시 자동 빌드 + npm publish. Node 20 사용, pnpm 캐싱 적용.
**참고**: .github/workflows/publish.yml
```
