# Agent Guidelines

AI Agents must read `docs/DEV_CONVENTION.md` before starting any development.

## Project Map

- Server entry and route registration: `packages/server/src/app.ts`, `packages/server/src/routes`
- Server features: `packages/server/src/features/<domain>` (`http`, `services`, `pages`)
- Shared server helpers: `packages/server/src/platform`
- One-time BLEX 3.14 import and verification: `packages/server/src/compat`, `packages/server/prisma/legacy`
- SQLite schema and the `0001_init` migration: `packages/server/prisma`
- Tests and fixtures: `packages/server/test`
- React screens and browser runtime: `packages/client`
- Shared UI and editor: `packages/client/src/ui`, `packages/client/src/features/editor/tiptap`
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
