# Agent Guidelines

AI Agents must read `docs/DEV_CONVENTION.md` before starting any development.

## Project Map

- Server entry and route registration: `packages/server/src/app.ts`, `packages/server/src/routes`
- Server features: `packages/server/src/features/<domain>` (`http`, `services`, `pages`)
- Shared server helpers: `packages/server/src/platform`
- BLEX 3.x compatibility code: `packages/server/src/compat`
- SQLite schema and migrations: `packages/server/prisma`
- Tests and fixtures: `packages/server/test`
- BLEX 3.14 React screens used by BLEX 4: `packages/web`
- Shared UI and editor: `packages/ui`, `packages/editor`
- BLEX 3.x compatibility reference: git tag `v3.14`
- Project docs: `docs`

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
