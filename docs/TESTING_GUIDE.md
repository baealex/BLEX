# Testing Guide

Test behavior that can break: persistence, permissions, visibility, state transitions, and error handling. Test through HTTP routes using a temporary SQLite database where possible. Mock external network services rather than internal business logic.

## Server tests

The suite lives in `packages/server/test/` and uses Node's test runner, Fastify `app.inject`, and SQLite fixtures.

Run from the repository root using the pnpm version declared in `package.json`:

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm type-check
```

`pnpm test` builds the server and its browser entry points, then runs `packages/server/dist/test/*.test.js`. For a focused run:

```sh
pnpm build
node --test packages/server/dist/test/public-discovery.test.js
node --test --test-name-pattern='sitemap' packages/server/dist/test/public-discovery.test.js
```

## Fixtures and assertions

- Use `packages/server/test/fixtures/migrated-database.ts` when constraints, relationships, or mutations matter. `createMigratedDatabase` applies all shipped SQL migrations and creates a temporary database and media directory.
- Use `seedEditor`, `seedPost`, and `signIn` for common setup. The session helper supplies cookies, CSRF, and origin headers.
- Small schema fixtures are useful for focused read-only tests, but must not replace migration-backed coverage for writes.
- Close the Fastify app and database connections before removing temporary files. Never point tests at a developer's data or media directory.
- Assert status codes, bodies, headers, and persisted state. Cover unauthenticated access, another user's resources, and invalid input where relevant.
- Keep tests independent of execution order. Avoid assertions about private calls, incidental markup, visual spacing, or CSS classes.

See [Backend Compatibility](BACKEND_COMPATIBILITY.md) for the test files covering each public contract. Visibility changes must cover HTML, Markdown, discovery endpoints, and RSS together.

## Web, UI, and editor checks

Run from the repository root after installing dependencies:

```sh
pnpm i18n:check
pnpm lint
pnpm type-check
pnpm test:web
pnpm build:web
pnpm check:entry-budgets
```

Editor and web logic tests live in `packages/editor/test/` and `packages/web/test/` and use Node's test runner. Use browser checks for behavior that needs real DOM APIs, built assets, or navigation. Avoid adding browser tests for pure logic or visual preferences.

For the existing browser smoke test, start a new instance with a temporary database, built web assets, and a setup token you can provide to the test, then run:

```sh
pnpm --filter @blex/web exec playwright install --only-shell chromium
BLEX_SETUP_TOKEN=your-setup-token pnpm test:smoke
```

The test creates the first administrator account, then checks signing out, signing back in, opening the mobile menu, loading the editor, and keeping the author's text when the server rejects a publish. `BLEX_SMOKE_URL` overrides the default `http://127.0.0.1:8040` target.

## Migrations and CI

Verify schema changes on an empty SQLite database and a copy prepared with the [upgrade guide](UPGRADE_FROM_3.md). Cover constraint changes with representative data, including invalid duplicates where relevant.

[CI](../.github/workflows/CI.yml) runs the server build and tests, Prisma validation, web checks, and container verification. The container job launches a new instance with a 512 MiB memory limit and runs the browser smoke test.
