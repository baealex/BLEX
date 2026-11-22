# Development Conventions

## Branches, commits, and PRs

- Name branches `<type>/<scope>-<summary>` using lowercase kebab-case. Types: `feat`, `fix`, `refactor`, `chore`, `test`, `docs`.
- Commit messages and PR titles use an emoji followed by an English summary: `🐛` fix, `✨` feature, `♻️` refactor, `🧪` tests, `📦` dependencies.
- Example: `fix/settings-posts-ui-consistency` and `🐛 Prevent draft posts from being pinned`.
- PR bodies follow [the PR template](../.github/PULL_REQUEST_TEMPLATE.md).

## Documentation language

Write project guides, package READMEs, and linked architecture documents in English to match `README.md`. Keep `README.ko.md` as the Korean overview and label any additional localized guides explicitly.

## Local development

Use the Node.js version required by the root `package.json` and `.nvmrc`.

```sh
pnpm install
pnpm dev
```

The development command builds the app and starts the server at `http://localhost:8040`. It also initializes a local SQLite database and generates secrets under `packages/server/.local/`. It does not watch source files; restart it after changes. FFmpeg is needed for local GIF conversion and video previews.

## Backend

Read [Backend Guide](BACKEND_GUIDE.md) and [Testing Guide](TESTING_GUIDE.md).

- Put domain code in `packages/server/src/features/<domain>`: `http` for routes, `services` for business logic and data access, and `pages` for SSR screens. Register routes from `packages/server/src/routes/index.ts`.
- Keep shared response, CSRF, cookie, and header helpers in `packages/server/src/platform/`; stored data formats and upgrade checks belong in `packages/server/src/compat/`.
- Prisma schema and migrations live in `packages/server/prisma/`.
- Keep authorization, validation, and ownership checks in shared services when multiple routes perform the same operation.
- Add regression coverage for behavior changes. Verify schema changes on an empty database and an upgraded database copy; see the [upgrade guide](UPGRADE_FROM_3.md).
- Preserve the observable contracts listed in [Backend Compatibility](BACKEND_COMPATIBILITY.md) during refactors.

## Frontend

Read [Frontend Guide](FRONTEND_GUIDE.md), [Design Guide](DESIGN_GUIDE.md), and [UI Change Style Guide](UI_CHANGE_STYLE_GUIDE.md).

- Use `renderApplicationDocument` for app pages. Include initial page data in the SSR response and clean up browser features when navigating away.
- The main application and browser entry points live in `packages/server/src/`. React screens live in `packages/web/`; shared controls and the reusable Tiptap editor live in `packages/ui/` and `packages/editor/`.
- Follow the existing screen's component and data-fetching patterns. Run the checks for the workspace you changed.

## Internationalization

Read [Translation Guide](TRANSLATION_GUIDE.md) for catalog locations and current coverage limits.

- Use English source messages in translation catalogs and have Korean translations reviewed.
- Preserve user-authored content exactly as written.
- Keep API keys, enums, numbers, and ISO-formatted dates independent of translated display text.
- Web screens read the locale supplied by the server; do not independently select a locale based on the browser's language.

## Verification

Run from the repository root:

```sh
pnpm test
pnpm type-check
```

`pnpm test` includes the application build. For web, UI, or editor changes, also run the workspace checks as described in the [Testing Guide](TESTING_GUIDE.md).
