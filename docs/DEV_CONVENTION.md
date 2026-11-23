# Development Conventions

## Branches, commits, and PRs

- Name branches `<type>/<scope>-<summary>` using lowercase kebab-case. Types: `feat`, `fix`, `refactor`, `chore`, `test`, `docs`.
- Commit messages and PR titles use an emoji followed by an English summary: `🐛` fix, `✨` feature, `♻️` refactor, `🧪` tests, `📦` dependencies.
- Example: `fix/settings-posts-ui-consistency` and `🐛 Prevent draft posts from being pinned`.
- PR bodies follow [the PR template](../.github/PULL_REQUEST_TEMPLATE.md).

## Documentation language

Write project guides, package READMEs, and linked architecture documents in English to match `README.md`. Keep `README.ko.md` as the Korean overview and label any additional localized guides explicitly.

Keep release procedures independent of a particular release number. Use `MAJOR.MINOR` placeholders and derive actual release versions from repository metadata and Git tags.

## Local development

Use the Node.js version required by the root `package.json` and `.nvmrc`.

```sh
pnpm install
pnpm dev
```

The development command builds the app and starts the server at `http://localhost:8040`. It also initializes a local SQLite database and generates secrets under `packages/server/.local/`. It does not watch source files; restart it after changes. Settings and editor pages are React screens, so run `pnpm build:client` first; without those assets they answer 503. FFmpeg is needed for local GIF conversion and video previews.

## Backend

Read [Backend Guide](BACKEND_GUIDE.md) and [Testing Guide](TESTING_GUIDE.md).

- Put domain code in `packages/server/src/features/<domain>`: `http` for routes and `services` for business logic and data access. Views belong in `packages/client`. Register routes from `packages/server/src/routes/index.ts`.
- Keep shared response, CSRF, cookie, date format, and header helpers in `packages/server/src/platform/`. Only the one-time BLEX 3.14 import and its verification belong in `packages/server/src/compat/`.
- Prisma schema and migrations live in `packages/server/prisma/`. `0001_init` stays the single migration until 4.0 ships; after that, new migrations stack on it.
- Use the Prisma model API for database access. Raw SQL needs a documented reason; see the [Backend Guide](BACKEND_GUIDE.md#database-changes).
- `/v1` request and response fields are camelCase. The Developer API keeps its public snake_case contract through `features/developer-api/wire-format.ts`.
- Keep authorization, validation, and ownership checks in shared services when multiple routes perform the same operation.
- Add regression coverage for behavior changes. Verify schema changes on an empty database and an upgraded database copy; see the [upgrade guide](UPGRADE_FROM_3.md).
- Preserve the observable contracts listed in [Backend Compatibility](BACKEND_COMPATIBILITY.md) during refactors.

## Frontend

Read [Frontend Guide](FRONTEND_GUIDE.md), [Design Guide](DESIGN_GUIDE.md), and [UI Change Style Guide](UI_CHANGE_STYLE_GUIDE.md).

- Add server-rendered pages as `packages/client/src/routes/**/*.page.tsx` and call them with `renderPage`. Include initial page data in the SSR response and clean up browser features when navigating away.
- Client routes live in `packages/client/src/routes/`, their screens in `packages/client/src/features/<domain>/`, and shared controls in `packages/client/src/ui/`.
- Follow the existing screen's component and data-fetching patterns. Run the checks for the workspace you changed.

## Internationalization

Read [Translation Guide](TRANSLATION_GUIDE.md) for catalog locations and current coverage limits.

- Use English source messages in translation catalogs and have Korean translations reviewed.
- Preserve user-authored content exactly as written.
- Keep API keys, enums, numbers, and ISO-formatted dates independent of translated display text.
- Web screens read the locale supplied by the server; do not independently select a locale based on the browser's language.
- Resolve supported UI languages in this order: the user's saved preference, then the site's default (`BLEX_DEFAULT_LANGUAGE`, falling back to Korean). Use `platform/locale.ts` for server-side selection.

## Verification

Run from the repository root:

```sh
pnpm test
pnpm type-check
```

Biome formats and lints the repository. Run `pnpm format` to apply fixes; `pnpm lint` is the CI check.

`pnpm test` includes the application build. For web, UI, or editor changes, also run the workspace checks as described in the [Testing Guide](TESTING_GUIDE.md).

Regular CI runs application and client checks. Explicit releases use the manual `BUILD.yml` workflow: application checks, a candidate build, AMD64/ARM64 runtime/browser/security checks, then publication of the verified digest and automatic Git tagging. Follow [Releasing BLEX](RELEASING.md); Git tag pushes do not trigger releases. Published images also receive weekly security scans.

For dependency updates, read [Dependency Maintenance](DEPENDENCY_SECURITY.md). The [architecture diagram](blex4-architecture.html) illustrates request flows and code boundaries.
