# BLEX Development Guide

Complete environment setup (backend + frontend) can be done with `npm i`.

## Backend (Python Django) Work

- Always write test code for all development.
  - Run tests with `npm run server:test`.
- For server-side rendering + client interactions, use `alpine`.
  - Template components should have corresponding `*.alpine.ts` scripts and `*.scss` files in the same location.
    - These are automatically mapped when running `pnpm dev`, but if not, you need to update the following files:
      - `/backend/islands/apps/remotes/styles/forwarded.scss`
      - `/backend/islands/apps/remotes/src/scripts/alpine-loader.ts`

## Islands Frontend (React + Vite) Work

- **IMPORTANT**: Lint and type checks are **ONLY** for Islands (React) work, **NOT** for template work.
  - After development, run lint and type checks:
    - `npm run islands:lint` for linting
    - `npm run islands:type-check` for type checking
  - These checks have no meaning for Django template work.
- This is a monorepo frontend architecture.
  - Common components are located in `/backend/islands/packages/ui`.
    - Don't reinvent the wheel—use proven libraries like `radix`.
    - Components should be highly reusable and follow the design philosophy.
  - The editor is located in `/backend/islands/packages/editor`.
    - The editor is based on `tiptap`.
    - As a core feature of the project, prioritize UI and UX above all.

## Design/UI Work

**Always read `docs/DESIGN_GUIDE.md` first.**
