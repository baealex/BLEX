# Agent Guidelines

AI Agents must read `docs/DEV_CONVENTION.md` before starting any development.

## Project Map

- BLEX 4 Fastify routes and React SSR: `v4/src`
- SQLite schema and migrations: `v4/prisma`
- Tests and fixtures: `v4/test`
- BLEX 3.14 React screens used by BLEX 4: `v4/islands`
- BLEX 3.x compatibility reference: git tag `v3.14`
- Project docs: `docs`

## Development Commands

- Install dependencies: `npm install`
- Start local development: `npm run dev`
- Build the application: `npm run build`
- Run tests: `npm test`
- Run TypeScript checks: `npm --prefix v4 run type-check`

## Agent-Readable Public Surface

- AI entry point: `/llms.txt`
- Post Markdown convention: `/@{username}/{post_url}.md`
- Sitemap index: `/sitemap.xml`
- Posts sitemap: `/posts/sitemap.xml`
- RSS feed: `/rss`

When changing public post visibility, sitemap behavior, or Markdown rendering, update the agent-readable endpoints and their tests together.
