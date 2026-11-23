# Agent Guidelines

AI Agents must read `docs/DEV_CONVENTION.md` before starting any development.

## Project Map

- Server entry and route registration: `packages/server/src/app.ts`, `packages/server/src/routes`
- Server features, which hold APIs and page data: `packages/server/src/features/<domain>` (`http`, `services`)
- Shared server helpers: `packages/server/src/platform`
- One-time BLEX 3.14 import and verification: `packages/server/src/compat`, `packages/server/prisma/legacy`
- SQLite schema and the `0001_init` migration: `packages/server/prisma`
- Tests and fixtures: `packages/server/test`
- Client routes, where each URL is a file: `packages/client/src/routes` (`*.page.tsx` renders on the server, other files are browser routes)
- Data the server passes to each page: `packages/client/src/contracts`
- Client features: `packages/client/src/features/<domain>`
- Shared UI: `packages/client/src/ui`
- Project docs: `docs`

## Releases

For explicit release requests, follow [the release procedure](docs/RELEASING.md). Dispatch the Release workflow on main and monitor it through publication. The workflow creates Git version tags after testing; do not push tags to trigger a release.

## Development Commands

- Install dependencies: `pnpm install`
- Start local development: `pnpm dev`
- Build the application: `pnpm build`
- Run tests: `pnpm test`
- Run TypeScript checks: `pnpm type-check`

## Agent-Readable Public Surface

- AI entry point: `/llms.txt`
- Post Markdown convention: `/@{username}/{post_url}.md`
- Sitemap index: `/sitemap.xml`
- Posts sitemap: `/posts/sitemap.xml`
- RSS feed: `/rss`

When changing public post visibility, sitemap behavior, or Markdown rendering, update the agent-readable endpoints and their tests together.
