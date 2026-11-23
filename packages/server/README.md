# BLEX Server

Fastify serves HTTP APIs and static assets, loads page data, and renders the views from `packages/client`. Prisma manages the SQLite schema. Domain code lives in `src/features/`. Routes are registered in `src/routes/`, and shared HTTP helpers live in `src/platform/`.

Run `pnpm install` and `pnpm dev` from the repository root. See the [development conventions](../../docs/DEV_CONVENTION.md) and [backend guide](../../docs/BACKEND_GUIDE.md) for code layout and checks.

- [Installation and operations](../../docs/SELF_HOSTING.md)
- [Upgrade from BLEX 3.14 to 4](../../docs/UPGRADE_FROM_3.md)
