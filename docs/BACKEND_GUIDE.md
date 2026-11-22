# Backend Guide

BLEX uses Fastify, TypeScript, Prisma, and SQLite. `packages/server/src/main.ts` reads runtime configuration; `packages/server/src/app.ts` builds the application, and `packages/server/src/routes/index.ts` registers routes.

## Code layout

| Area | Location |
| --- | --- |
| Public pages and post queries | `packages/server/src/features/discovery/`, `packages/server/src/features/posts/public-post.ts`, `packages/server/src/features/posts/pages/public-post-page.tsx` |
| Login, sessions, OAuth, and two-factor authentication | `packages/server/src/features/auth/` |
| Post editing and collections | `packages/server/src/features/posts/authoring/`, `packages/server/src/features/series/` |
| Personal and administrator settings | `packages/server/src/features/account/`, `packages/server/src/features/site-admin/` |
| RSS, sitemaps, and public Markdown | `packages/server/src/features/discovery/feeds/` |
| Developer API and token scopes | `packages/server/src/features/developer-api/` |
| Notifications and webhook delivery | `packages/server/src/features/notifications/`, `packages/server/src/features/integrations/webhooks/` |
| Schema and migrations | `packages/server/prisma/` |

## Request handling

- Routes parse HTTP input and return responses. Reuse server services for operations shared by HTML forms and HTTP APIs. Keep domain code in `features/<domain>`, shared HTTP helpers in `platform/`, and code for compatibility with stored data formats in `compat/`.
- Check authentication, role, ownership, and visibility on the server. Client-side checks help users navigate the interface; they do not enforce access control.
- Validate CSRF tokens on state-changing browser requests. Follow the existing scoped-token checks for the Developer API.
- Use explicit parameter and return types at module and API boundaries. Keep code and comments in English.
- Keep initial page data in the SSR response. Use `renderApplicationDocument` for pages served by the shared React app.
- Sanitize post HTML with the existing post renderer. Serve private media only through routes that check access permissions.

## Database changes

- Update `schema.prisma` and add a migration under `packages/server/prisma/migrations/`. Keep released migrations unchanged.
- Some existing SQLite column types are represented as `Unsupported` in Prisma. Follow the existing parameterized SQL access patterns for these columns.
- Bind SQL values through Prisma's tagged templates or SQLite placeholders. Never interpolate user input into SQL text.
- Use transactions when an operation changes related rows or queues notifications and webhooks.
- Verify migrations against both an empty database and an upgraded database copy. Preserve valid data and relationships when adding constraints.
- Apply migrations with `DATABASE_URL=file:/absolute/path/to/db.sqlite3 pnpm db:migrate`. Build first when using the database verification CLI.

## Refactoring and testing

Preserve routes, response envelopes, URLs, and session behavior during refactors; see [Backend Compatibility](BACKEND_COMPATIBILITY.md). Test observable outcomes, including persisted state and denied access. Mock external services used to deliver notifications or webhooks.

Run `pnpm test` and `pnpm type-check`. See [Testing Guide](TESTING_GUIDE.md) for focused commands and fixtures, and [Translation Guide](TRANSLATION_GUIDE.md) for localized messages.
