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
- `application-screens.test.ts` walks representative `/v1` responses and fails on any snake_case key. Add a new endpoint family there, and list a key in its allowlist only when an external service defines it.
- Keep tests independent of execution order. Avoid assertions about private calls, incidental markup, visual spacing, or CSS classes.
- Related-post race tests change a ranked winner before its details load and verify that private posts, deleted posts, and inactive authors are omitted.

See [Backend Compatibility](BACKEND_COMPATIBILITY.md) for the test files covering each public contract. Visibility changes must cover HTML, Markdown, discovery endpoints, and RSS together.

## Web, UI, and editor checks

Run from the repository root after installing dependencies:

```sh
pnpm i18n:check
pnpm lint
pnpm type-check
pnpm test:client
pnpm build:client
pnpm check:entry-budgets
```

Editor and web logic tests live in `packages/client/test/` and use Node's test runner. Use browser checks for behavior that needs real DOM APIs, built assets, or navigation. Avoid adding browser tests for pure logic or visual preferences.

Run the browser smoke test against an automatically managed local instance after building the server and browser assets:

```sh
pnpm build
pnpm --filter @blex/client exec playwright install --only-shell chromium
pnpm test:browser
```

The runner creates a temporary database, media directory, setup token, and local server, then removes them after the check. It does not use a developer's database.

To check a running instance instead, start a new instance with a temporary database, built web assets, and a setup token you can provide to the test, then run:

```sh
pnpm --filter @blex/client exec playwright install --only-shell chromium
BLEX_SETUP_TOKEN=your-setup-token pnpm test:smoke
```

The test creates the first administrator account, then checks signing out, signing back in, opening the mobile menu, keyboard editor commands, and keeping the author's text when the server rejects a publish. The editor opens from the site header in the same document, and unsaved edits ask before a header link or the back button leaves it. It also verifies that late draft responses cannot replace newer results, media controls retain keyboard focus, and settings labels activate their controls. Screens render in the application's single React root and leave no element behind when the reader moves back to a public page. Signing out from a settings screen, and natively before the page hydrates, removes the viewer's session caches and keeps a signed-out visitor's. Those sign-outs, and one from the post editor with unsaved edits, also remove the account's unsaved edits from browser storage, and the editor case checks that recent searches stay. Invalid screen names, malformed page data, and incorrectly typed props must show the screen's error without inserting HTML, whether the page is opened directly or from inside the application. A screen that throws must show its error fallback, and in both cases the application must keep moving between pages. A toaster that fails to load or throws must leave the page, its typed text, and in-app navigation working. A post whose body gives an element an id that the browser also exposes on `window`, such as `blexHistory`, must keep in-app navigation working. Pinned-post choices support native radio arrow-key navigation and clear the selection when the search changes.

The writing journey saves a draft with inline and cover images, reloads it, publishes it, recovers unsaved edits after a reload, updates the published post, and moves it to the trash and back. It also delays a real autosave request and verifies that edits typed while it is pending are subsequently saved. The checks cover mobile and desktop widths and reopen saved states to verify the content and images. These requests use the real server and database. `BLEX_SMOKE_URL` overrides the default `http://127.0.0.1:8040` target for `pnpm test:smoke`.

Settings list checks create real series, verify that Space activates a list item on key release, reorder through a separate keyboard drag handle, and open the edit menu at a mobile width. The list title remains available as a heading.

Focus checks cover adding tags, returning to the add button with Escape, leaving an empty tag field, and clearing a search. Entering search and moving backward or forward through search history must not grab input focus. Before the page hydrates, Cmd/Ctrl+K focuses the header search box and Esc closes it as it does afterward, and afterward two quick presses of Esc close the panel and then clear the box. Theme checks preserve the preference between public pages and settings after reload, and follow the system when the cookie is absent. Cookie policy tests cover the one-year lifetime, site-wide path, SameSite setting, HTTPS-only Secure attribute, and deletion for the system preference.

## Migrations and CI

Verify schema changes on an empty SQLite database and a copy prepared with the [upgrade guide](UPGRADE_FROM_3.md). Cover constraint changes with representative data, including invalid duplicates where relevant. Until 4.0 ships, `0001_init` must match the output of the regeneration command in the [Backend Guide](BACKEND_GUIDE.md#database-changes).

[CI](../.github/workflows/CI.yml) runs the server build and tests, Prisma validation, web checks, browser smoke test, and fast release orchestration tests on PRs and main pushes. The manual [Release workflow](../.github/workflows/BUILD.yml) reuses these checks, then tests the same candidate image with 512 MiB and a browser on native AMD64 and ARM64 before publishing. See [Releasing BLEX](RELEASING.md) for the agent procedure and retry behavior.
