# Frontend Guide

BLEX renders pages with React on the server and uses a shared TanStack Router application for browser navigation. Additional React screens are loaded from `packages/client/` through the server screen host.

## Code layout

| Area | Location |
| --- | --- |
| Shared app document, frame, and navigation | `packages/client/src/application/` |
| Public layout, theme, and styles | `packages/client/src/appearance/` |
| Login and reader interactions | `packages/client/src/features/auth/ui/`, `packages/client/src/features/engagement/ui/` |
| Web host and browser configuration | `packages/server/src/application/screen-host/` |
| Client routes, where each URL is a file | `packages/client/src/routes/` |
| Types for the data each server-rendered page receives | `packages/contracts/src/` |
| Screens and feature code | `packages/client/src/features/<domain>/` |
| Shared UI primitives | `packages/client/src/ui/` |
| Tiptap editor | `packages/client/src/features/editor/tiptap/` |

The client package produces three builds under `packages/server/dist/`: `web` for React screens, `client` for the public browser entry points, and `ssr` for the views the server renders.

Public pages and React screens share the theme, prose, and syntax styles in `packages/client/src/appearance/`. `packages/client/styles/main.scss` adds screen-document scrolling, media transitions, and print rules.

## Routes

Add a client URL by adding a file under `packages/client/src/routes/`. A `*.page.tsx` file renders on the server and ships no JavaScript of its own: its server route loads the data and calls `renderPage` with the file's path as the id, and `packages/contracts/src/pages.d.ts` types those props. Any other route file is a browser route. Keep browser route files thin: they declare the path, access guard, and lazy page, and the page itself lives in `features/<domain>`. The Vite plugin regenerates `src/routeTree.gen.ts`; commit that file and do not edit it by hand.

The post detail page is the one server-rendered page in the main React tree: `features/posts/post-page.tsx` renders on the server and hydrates in the browser. Its data is a JSON script built field by field in `post-page-data.ts`. Everything there is public in the HTML, and the post body stays out because hydration reads it from the server markup.

## Pages and browser behavior

- Use `renderApplicationDocument` from a `*.page.tsx` file for pages in the main application so direct visits receive server-rendered HTML and internal navigation uses the app router.
- Include the initial content and metadata in the server response. Avoid a second browser request for data already needed to render the page.
- Initialize browser features when their route loads. Remove event listeners, disconnect observers, and destroy editor instances when navigating away.
- Keep browser-only APIs out of server render paths. Load large editor and interaction modules when the relevant screen needs them.
- Keep forms, focus, keyboard navigation, loading feedback, and error states usable. Check direct visits, internal navigation, and back/forward behavior.

## Components, state, and requests

- Keep props and API boundaries typed. Prefer composition and existing shared controls over new configurable component systems.
- Decode screen-host JSON as `unknown` and validate it with `components/screen-props.ts` before rendering. Keep the screen name paired with its component props, and update the parser when a screen's inputs change.
- Put shareable filters and pagination in the URL; keep transient form and interaction state local.
- Follow the request pattern used by the code you are changing. The main app uses browser `fetch` and forms; web screens use their existing Axios client, React Query, and form libraries.
- Preserve the runtime's CSRF handling and check API error responses before consuming their bodies.
- React Compiler is configured for the web package build. Do not assume it is enabled for the main Vite app, or add memoization without a measured need.

## Styling and translation

Use semantic Tailwind tokens and follow the [Design Guide](DESIGN_GUIDE.md) and [UI Change Style Guide](UI_CHANGE_STYLE_GUIDE.md). Keep screen-specific CSS close to the feature.

The server sets the document language from the user preference or site default. Public SSR and browser components use `ui()` with literal English product copy; React screens use the existing Lingui macros. Both use the same PO catalogs. Activate the document catalog before hydration and the destination catalog before internal navigation. Resolve translated labels during rendering, never at module initialization. Do not pass authored content through translation helpers or create a separate runtime per feature. See [Translation Guide](TRANSLATION_GUIDE.md) for current coverage and checks.

## Development and checks

Follow the [local development setup](DEV_CONVENTION.md#local-development). Build additional screens with `pnpm build:client` and restart the app after the first build so it discovers the assets. `pnpm dev:client` runs Vite directly on port 8100 with its built-in file watcher.

Run `pnpm test` and `pnpm type-check` for changes to the main application. The client type check covers browser code and all Vite/Lingui configuration files. For web changes, use the workspace commands in the [Testing Guide](TESTING_GUIDE.md).
