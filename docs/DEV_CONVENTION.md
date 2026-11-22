# Development Conventions

## Branches, commits, and PRs

- Branches use `<type>/<scope>-<summary>` in lowercase kebab-case. Types: `feat`, `fix`, `refactor`, `chore`, `test`, `docs`.
- Commit messages and PR titles use an emoji followed by an English summary: `🐛` fix, `✨` feature, `♻️` refactor, `🧪` tests, `📦` dependencies.
- Example: `fix/settings-posts-ui-consistency` and `🐛 Prevent draft posts from being pinned`.
- PR bodies follow [the PR template](../.github/PULL_REQUEST_TEMPLATE.md).

## Local development

Use the Node.js version required by the root `package.json` and `.nvmrc`.

```sh
pnpm install
pnpm dev
```

The development command builds the app, initializes SQLite and secrets under `packages/server/.local/`, and starts `http://localhost:8040`. It does not watch source files; restart it after changes. FFmpeg is needed for local GIF conversion and video previews.

## Backend

Read [Backend Guide](BACKEND_GUIDE.md) and [Testing Guide](TESTING_GUIDE.md).

- Put domain code in `packages/server/src/features/<domain>`: `http` for routes, `services` for rules and storage, and `pages` for SSR screens. Register routes from `packages/server/src/routes/index.ts`.
- Keep shared response, CSRF, cookie, and header helpers in `packages/server/src/platform/`; persisted formats and upgrade checks belong in `packages/server/src/compat/`.
- Prisma schema and migrations live in `packages/server/prisma/`.
- Keep authorization, validation, and ownership checks in shared services when multiple routes perform the same operation.
- Add regression coverage for behavior changes. Verify schema changes on an empty database and an upgraded database copy; see the [upgrade guide](UPGRADE_FROM_3.md).
- Preserve the observable contracts listed in [Backend Compatibility](BACKEND_COMPATIBILITY.md) during refactors.

## Frontend

Read [Frontend Guide](FRONTEND_GUIDE.md), [Design Guide](DESIGN_GUIDE.md), and [UI Change Style Guide](UI_CHANGE_STYLE_GUIDE.md).

- Use `renderApplicationDocument` for app pages. Include initial page data in the SSR response and clean up browser features when navigating away.
- The main app and client entries live in `packages/server/src/`. React screens live in `packages/web/`; shared controls and the reusable Tiptap editor live in `packages/ui/` and `packages/editor/`.
- Follow the existing screen's component and data-fetching patterns. Run the checks for the workspace you changed.

## Internationalization

Read [Translation Guide](TRANSLATION_GUIDE.md) for catalog locations and current coverage limits.

- Use English source messages in translation catalogs and keep Korean translations reviewed.
- Preserve user-authored content exactly as written.
- Keep API keys, enums, numbers, and ISO dates independent of translated display text.
- Web screens read the locale supplied by the server; do not negotiate a separate browser locale.

## Verification

Run from the repository root:

```sh
pnpm test
pnpm type-check
```

`pnpm test` includes the application build. For web, UI, or editor changes, also run the workspace checks as described in the [Testing Guide](TESTING_GUIDE.md).
