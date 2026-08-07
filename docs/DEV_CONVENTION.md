
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
- Complete environment setup (backend + frontend) can be done with `npm i`.

## Backend Guidelines
- **Always read `docs/BACKEND_GUIDE.md` first.**
- Always write test code for all development.
  - Run tests with `npm run server:test`.
  - Read `docs/TESTING_GUIDE.md` for more information.
- For server-side rendering + client interactions, use `alpine`.
  - Template components should have corresponding `*.alpine.ts` scripts and `*.scss` files in the same location.
    - These are automatically mapped when running `pnpm dev`, but if not, you need to update the following files:
      - `/backend/islands/apps/remotes/styles/forwarded.scss`
      - `/backend/islands/apps/remotes/src/scripts/alpine-loader.ts`

## Frontend Guidelines
- **Always read `docs/FRONTEND_GUIDE.md` first.**
- Prefer `npm run islands:test` for pure logic. Reserve Playwright E2E tests for behavior that requires browser APIs, built assets, or production runtime integration.
- **IMPORTANT**: Lint and type checks are **ONLY** for Islands (React) work, **NOT** for template work.
  - After development, run lint and type checks:
    - `npm run islands:lint` for linting
    - `npm run islands:type-check` for type checking
  - These checks have no meaning for Django template work.
- This is a monorepo frontend architecture.
  - Common components are located in `/backend/islands/packages/ui`.
    - Don't reinvent the wheel—use proven libraries like `radix`.
    - Components should be highly reusable and follow the design philosophy.
  - The editor is located in `/backend/islands/packages/editor`.
    - The editor is based on `tiptap`.
    - As a core feature of the project, prioritize UI and UX above all.

## Internationalization Guidelines

- Django owns the document locale. Templates, `<html lang>`, `Content-Language`, `window.configuration.locale`, islands, and same-origin APIs must agree.
- Keep English as the source message and commit reviewed Korean translations. Do not translate posts, queries, usernames, or other user-authored content.
- Django messages live in `backend/src/locale`; remotes messages live in `backend/islands/apps/remotes/src/locales`. Do not create a shared cross-runtime catalog.
- New API contracts carry stable keys, enums, numbers, and ISO dates before localized fallback text.
- Run `npm run server:compilemessages` after Django catalog edits and `npm run islands:i18n:check` after Islands message edits.
- Production remains Korean-only unless `ENABLE_ENGLISH_UI=TRUE` is explicitly set after a coherent English journey is ready.

## Design Guidelines
- **Always read `docs/DESIGN_GUIDE.md` first.**
- For UI implementation style and scope control, read `docs/UI_CHANGE_STYLE_GUIDE.md`. This is separate from the design system.
