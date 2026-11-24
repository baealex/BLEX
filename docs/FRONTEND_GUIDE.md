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

The post detail, home, tag list, tag, author, series, static, 404, 403, Developer API quickstart, and sign-in pages render in the main React tree: `features/posts/post-page.tsx`, `features/discovery/discovery-page.tsx`, the `features/authors/author-*-page.tsx` route modules, `features/discovery/static-page.tsx`, `not-found-page.tsx`, `forbidden-page.tsx`, `features/developer-api/quickstart.tsx`, and `features/auth/ui/login-page.tsx` render on the server and hydrate in the browser. Their data is a JSON script directly under `<body>`, built field by field in `post-page-data.ts`, `discovery-page-data.ts`, `author-page-data.ts`, `content-page-data.ts`, `quickstart-data.ts`, and `login-page-data.ts`. Everything there is public in the HTML. Authored HTML, such as a post body, an introduction, a series description, or a static page with its stylesheet, stays out because hydration reads it from the server markup, and so does the owner's introduction Markdown, which their editor's textarea already holds. The sign-in page carries only its form model, including the visitor's own CSRF token, and reads its footer back from the server markup.

Each author route, static page, error page, the quickstart, and the sign-in page loads only its own module. The sign-in form keeps credentials typed before its code arrives, and if that code fails to load, the server form still submits. When the post, author, or sign-in page's code fails to load on a direct visit, its server markup stays in place with any typed text and open menus, and links in it load full pages. The owner's inline introduction editor hydrates in its own Suspense boundary once its code arrives. On the introduction edit page, `features/authors/about-draft.ts` runs with the application entry: it restores a saved draft, holds hydration while a Hangul syllable is being composed, and accepts Save before the editor code arrives. If that code fails to load, the page keeps the writer's text and offers a retry that keeps it in the tab.

The login prompt and the one-time Telegram notice render in the application tree from `application/prompts.tsx`, on every application page, even when the page's own module did not load. The login prompt opens from a capture-phase click listener because React holds clicks inside a page whose code has not loaded.

## Pages and browser behavior

- Use `renderApplicationDocument` from a `*.page.tsx` file for pages in the main application so direct visits receive server-rendered HTML and internal navigation uses the app router.
- Include the initial content and metadata in the server response. Avoid a second browser request for data already needed to render the page.
- Initialize browser features when their route loads. Remove event listeners, disconnect observers, and destroy editor instances when navigating away.
- Moves within the application do not fire `beforeunload`. A screen that warns about unsaved edits also blocks the shared `window.blexHistory`, and returns its warning from `enableBeforeUnload` so the application leaves form posts to the browser while it applies.
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

The server sets the document language from the user preference or site default. Public SSR and browser components use `ui()` with literal English product copy; React screens use the existing Lingui macros. Both use the same PO catalogs, but the public page build keeps only the `ui()` messages and fails if public code uses a screen message. Activate the document catalog before hydration and the destination catalog before internal navigation. Resolve translated labels during rendering, never at module initialization. Do not pass authored content through translation helpers or create a separate runtime per feature. See [Translation Guide](TRANSLATION_GUIDE.md) for current coverage and checks.

## Development and checks

Follow the [local development setup](DEV_CONVENTION.md#local-development). Build additional screens with `pnpm build:client` and restart the app after the first build so it discovers the assets. `pnpm dev:client` runs Vite directly on port 8100 with its built-in file watcher.

Run `pnpm test` and `pnpm type-check` for changes to the main application. The client type check covers browser code and all Vite/Lingui configuration files. For web changes, use the workspace commands in the [Testing Guide](TESTING_GUIDE.md).
