## 백엔드 작업 시

- 모든 개발에는 테스트 코드를 작성한다.
  - 테스트 실행은 `pnpm server:test`로 실행한다.
- 서버 사이드 + 클라이언트 동작이 필요한 것은 `alpine`을 사용한다.
  - 템플릿 컴포넌트와 같은 위치에 `*.alpine.ts` 스크립트와 `*.scss` 파일이 위치한다.
    - `pnpm dev` 실행중엔 자동으로 매핑되지만 그렇지 않은 경우 아래 파일을 업데이트 해야한다.
      - `/backend/islands/apps/remotes/styles/forwarded.scss`
      - `/backend/islands/apps/remotes/src/scripts/alpine-loader.ts`

## 프론트엔드 작업 시

- 개발 후 린트와 타입 체크를 실행한다.
  - `pnpm islands:lint`와 `pnpm islands:type-check`로 실행한다.
- 모노레포로 구성된 프론트엔드이다.
  - 공통 컴포넌트는 `/backend/islands/packages/ui`에 위치한다.
    - 바퀴를 재발명하지 마라, `radix`와 같은 검증된 라이브러리를 써야한다.
    - 컴포넌트는 재사용성을 높히고 디자인 철학을 따라야 한다. 
  - 에디터는 `/backend/islands/packages/editor`에 위치한다.
    - 에디터는 `tiptap`을 기반으로 한다.
    - 에디터는 프로젝트의 핵심 기능이므로 UI와 UX를 최우선으로 고려한다.

## 디자인/UI 작업 시

**반드시 `docs/DESIGN_GUIDE.md`를 먼저 읽어라.**
