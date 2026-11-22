
# Development Conventions

## Branch Naming Convention
- Format: `<type>/<scope>-<summary>`
- Use lowercase English only.
- Use kebab-case for `<scope>` and `<summary>`.

### Allowed `type`
- `feat` new feature
- `fix` bug fix
- `refactor` refactoring / UX improvement
- `chore` maintenance
- `test` test work
- `docs` documentation

### Branch Examples
- `fix/settings-posts-ui-consistency`
- `feat/notify-webhook-channel`
- `refactor/settings-navigation-unification`

## Commit Convention
- Format: `emoji + work summary`
- Commit message must be in English.
- Emoji must match change intent.

### Emoji Mapping
- `🐛` bug fix
- `✨` new feature
- `♻️` refactor or UX/UI improvement
- `🧪` test-related changes
- `📦` dependency or package updates

### Commit Examples
- `♻️ Improve settings post management UX and pinning guards`
- `🐛 Prevent draft posts from being pinnable`

## PR Convention
- PR title follows the same rule as commit title: `emoji + work summary`.
- PR title must be in English.
- PR body must follow `.github/pull_request_template.md`.
- Fill all required sections in the template.

### PR Title Example
- `♻️ Improve settings post management UX and pinning guards`

## Environment Setup

- Run `pnpm install` at the repository root. Use `pnpm dev` for the local Node app with its separate SQLite database under `packages/server/.local/`.
- Use `pnpm build`, `pnpm test` and `pnpm type-check` to verify changes.

## BLEX 4

- Fastify routes, React SSR, and the Vite client entries live in `packages/server/src/`. Use `renderApplicationDocument` for app pages so direct visits receive SSR and internal links use the shared React router. Keep initial page data in the route's SSR response. Mount and clean up browser-only features with their route.
- Put server code in `packages/server/src/features/<domain>`: `http` for routes, `services` for rules and storage, and `pages` for SSR screens. Register feature routes only from `packages/server/src/routes/index.ts`.
- Keep shared response, CSRF, cookie, and header helpers in `platform`, and 3.x formats, contracts, and upgrade checks in `compat`.
- Keep authorization, data validation, and ownership checks in shared server services used by the routes that perform the same operation.
- Add regression tests in `packages/server/test/` and run them with `pnpm test`. Verify migration changes on an empty SQLite database and a 3.x copy using the [upgrade guide](../packages/server/README.md).
- Apply the design and UI change guides below to new React pages.

## BLEX 3.x reference

The remaining conventions cover the React screens in `packages/web`. Guidance about the Django app applies to the `v3.14` tag, where that code still lives.

## Backend Guidelines
- **Always read `docs/BACKEND_GUIDE.md` first.**
- Use one migration file per PR that requires a migration. Consolidate migration drafts for that PR before review.
- Always write test code for all development.
  - Run tests with `ppnpm test`.
  - Read `docs/TESTING_GUIDE.md` for more information.
- For server-side rendering + client interactions, use `alpine`.
  - Template components should have corresponding `*.alpine.ts` scripts and `*.scss` files in the same location.
    - These are automatically mapped when running `pnpm dev`, but if not, you need to update the following files:
      - `/packages/web/styles/forwarded.scss`
      - `/packages/web/src/scripts/alpine-loader.ts`

## Frontend Guidelines
- **Always read `docs/FRONTEND_GUIDE.md` first.**
- Prefer `ppnpm test:web` for pure logic. Reserve Playwright E2E tests for behavior that requires browser APIs, built assets, or production runtime integration.
- **IMPORTANT**: Lint and type checks are **ONLY** for Screens (React) work, **NOT** for template work.
  - After development, run lint and type checks:
    - `pnpm lint` for linting
    - `pnpm type-check` for type checking
  - These checks have no meaning for Django template work.
- This is a monorepo frontend architecture.
  - Common components are located in `/packages/ui`.
    - Don't reinvent the wheel—use proven libraries like `radix`.
    - Components should be highly reusable and follow the design philosophy.
  - The editor is located in `/packages/editor`.
    - The editor is based on `tiptap`.
    - As a core feature of the project, prioritize UI and UX above all.

## Internationalization Guidelines

- Django owns the document locale. Templates, `<html lang>`, `Content-Language`, `window.configuration.locale`, screens, and same-origin APIs must agree.
- Keep English as the source message and commit reviewed Korean translations. Do not translate posts, queries, usernames, or other user-authored content.
- Django messages live in `backend/src/locale`; remotes messages live in `packages/web/src/locales`. Do not create a shared cross-runtime catalog.
- New API contracts carry stable keys, enums, numbers, and ISO dates before localized fallback text.
- Run `npm run server:compilemessages` after Django catalog edits and `pnpm i18n:check` after Screens message edits.
- Production remains Korean-only unless `ENABLE_ENGLISH_UI=TRUE` is explicitly set after a coherent English journey is ready.

## Design Guidelines
- **Always read `docs/DESIGN_GUIDE.md` first.**
- For UI implementation style and scope control, read `docs/UI_CHANGE_STYLE_GUIDE.md`. This is separate from the design system.
