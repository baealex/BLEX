# Agent Guidelines

AI Agents must read `docs/DEV_CONVENTION.md` before starting any development.

## Project Map

- Backend Django app: `backend/src/board`
- Backend settings and middleware: `backend/src/main`
- Public resources: `backend/src/resources`
- React islands: `backend/islands`
- Project docs: `docs`

## Development Commands

- Install dependencies: `npm i`
- Start local development: `npm run dev`
- Run backend tests: `npm run server:test`
- Run island lint: `npm run islands:lint`
- Run island type checks: `npm run islands:type-check`

## Agent-Readable Public Surface

- AI entry point: `/llms.txt`
- Post Markdown convention: `/@{username}/{post_url}.md`
- Sitemap index: `/sitemap.xml`
- Posts sitemap: `/posts/sitemap.xml`
- RSS feed: `/rss`

When changing public post visibility, sitemap behavior, or Markdown rendering, update the agent-readable endpoints and their tests together.
