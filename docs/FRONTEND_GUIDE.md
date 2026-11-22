# Frontend Guide

BLEX renders pages with React on the server and connects a shared React Router app in the browser. Additional React screens are loaded from `packages/web/` through the server screen host.

## Code layout

| Area | Location |
| --- | --- |
| Shared app document, frame, and navigation | `packages/server/src/application/` |
| Public layout, theme, and styles | `packages/server/src/appearance/` |
| Login, editor, and reader interactions | `packages/server/src/features/auth/ui/`, `packages/server/src/features/posts/editor/`, `packages/server/src/features/engagement/ui/` |
| Web host and browser configuration | `packages/server/src/application/screen-host/` |
| Additional screens and their API client | `packages/web/` |
| Shared UI primitives | `packages/ui/` |
| Reusable Tiptap editor | `packages/editor/` |

`packages/server/vite.config.ts` builds the main browser entries into `packages/server/dist/client/`. The web package builds separately into `packages/server/dist/web/`; the Docker build includes both. Its `screen-loader.ts` loads the React runtime when a `data-screen` element appears, and `screen-runtime.tsx` mounts the requested screen after activating its locale.

## Pages and browser behavior

- Use `renderApplicationDocument` for shared-app pages so direct visits receive SSR and internal navigation uses the app router.
- Include the initial content and metadata in the server response. Avoid a second browser request for data already needed to render the page.
- Mount browser features with their route and release listeners, observers, and editor instances when leaving it.
- Keep browser-only APIs out of server render paths. Load large editor and interaction modules when their screen needs them.
- Keep forms, focus, keyboard navigation, loading feedback, and error states usable. Check direct visits, internal navigation, and back/forward behavior.

## Components, state, and requests

- Keep props and API boundaries typed. Prefer composition and existing shared controls over new configurable component systems.
- Put shareable filters and pagination in the URL; keep transient form and interaction state local.
- Follow the owning runtime's request pattern. The main app uses browser `fetch` and forms; web screens use their existing Axios client, React Query, and form libraries.
- Preserve the runtime's CSRF handling and check API error responses before consuming their bodies.
- React Compiler is configured for the web package build. Do not assume it is enabled for the main Vite app, or add memoization without a measured need.

## Styling and translation

Use semantic Tailwind tokens and follow [Design Guide](DESIGN_GUIDE.md) and [UI Change Style Guide](UI_CHANGE_STYLE_GUIDE.md). Keep screen-specific CSS close to the feature.

Web screens read the server-provided locale from `window.configuration.locale`, with the document language as fallback. Use the existing Lingui runtime and catalogs; do not create a separate instance per screen. See [Translation Guide](TRANSLATION_GUIDE.md) for current coverage and checks.

## Development and checks

```sh
pnpm install
pnpm dev
```

This builds and starts the main app at `http://localhost:8040`; restart after source changes. Use the pnpm version declared in the root `package.json`. Run `pnpm build:web` to build the additional screens and their UI/editor dependencies. Restart the app after the first web build so it finds the assets.

Run `pnpm test` and `pnpm type-check` for main-app changes. For web changes, use the workspace commands in [Testing Guide](TESTING_GUIDE.md).
