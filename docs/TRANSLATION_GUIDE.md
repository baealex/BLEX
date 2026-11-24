# Translation Guide

Keep product messages separate from posts, profile text, tags, queries, and other user-authored content. Preserve authored content exactly as written.

## Current coverage

Public pages and client-rendered React screens share the Lingui catalogs. Authentication, navigation, generated status messages, dates, and number formatting follow the selected UI language. The reusable editor keeps its type-checked catalog. Posts, profile text, site descriptions, notices, and other authored content remain in their original language. Unstructured historical notification content is also retained as written.

| Surface | Messages and locale handling |
| --- | --- |
| Web screens | `packages/client/src/locales/{locale}/messages.po`; host locale supplied by `packages/server/src/application/screen-host/index.ts` |
| Reusable editor | `packages/client/src/features/editor/tiptap/TiptapEditor/i18n/locales/{locale}.ts` |
| Public SSR and browser UI, including the shared header, footer, and quick search | `ui()` in `packages/client/src/i18n/public-ui.ts`, extracted into the same PO catalogs by `scripts/public-ui-extractor.mjs` |
| Server product messages and system notifications | English sources in `systemMessage()` calls; Korean translations under `server.` IDs in `packages/server/data/ui-messages.ko.json` |
| Developer API guide | Lingui macros with explicit `developer.` IDs in `features/developer-api/quickstart.tsx` and the guide's route pages, in the same PO catalogs |
| Developer API reference and errors | `developerText()` in `packages/server/src/features/developer-api/messages.ts`, with Korean translations under `developer.` IDs in the same `ui-messages.ko.json`; schema metadata is translated on a copy, preserving API names, enums, defaults, and examples |
| `/v1` status messages written as plain English | Translated by the response hook in `packages/server/src/platform/api-messages.ts` from `data/api-messages.ko.json` |

English is the source language for catalogs. Korean and English catalogs are included. Public pages load only the `public.` messages of a catalog (`messages.po`). Before a screen renders, `src/i18n/screen-catalog.ts` adds the rest (`messages.po?lingui`) to the same Lingui instance. The Developer API guide adds only its `developer.` messages (`messages.po?developer?lingui`) through `features/developer-api/developer-catalog.ts`; screens and other public pages never load them. The guide uses macros rather than `ui()` because the build drops a macro's English source from the page code, so the guide's sentences are downloaded once, in the reader's language. The web runtime reads the server-supplied document language; it does not choose a separate locale from `navigator.language`.

## Why the sources are separate

- The client's PO catalogs hold every message the browser renders. Each page downloads only the parts it uses: `public.` messages on every public page, `developer.` messages on the Developer API guide, and the rest on screens.
- The server keeps its own catalog because it formats messages outside React: API responses, notifications, Telegram and webhook deliveries, and page titles, often in another user's language. Reading the client's compiled catalogs would make the API depend on the client build, and the browser catalogs would have to leave out messages they never show. Developer API text uses `developer.` IDs because the Developer API words some site sentences differently, such as its token and permission errors.
- `/v1` handlers write more than 100 status sentences as plain English in over 200 places, and the response hook translates them. Some code still compares those English sentences, such as the sign-in wording and the Developer API's error codes, so moving them to `systemMessage()` is a refactor of its own. Use `systemMessage()` for new `/v1` messages: the fallback catalog is not checked for missing sentences.
- The reusable editor keeps type-checked catalogs that its hosts can override.

## Language priority

The server selects the UI language through `packages/server/src/platform/locale.ts`:

1. Use the user's saved language when it is supported and enabled.
2. Otherwise use the site's `BLEX_DEFAULT_LANGUAGE`, falling back to Korean if it is unset or unavailable.

Both `null` and an empty saved language inherit the site default. The language selector exposes this as **Site default**; existing `null` preferences continue to work. Browser language headers do not override these choices. New accounts inherit the site default unless an explicit language cookie supplies a supported choice.

The request locale is resolved after cookies are parsed, before page or API handlers run. AsyncLocalStorage isolates concurrent requests. Developer API requests use the token owner's preference. SSR passes that locale to the view renderer; browser entry points activate its catalog before hydration, and internal navigation activates the destination language before rendering. Telegram and personal webhook delivery resolve the recipient or channel owner's preference at delivery time.

`ENABLE_ENGLISH_UI=TRUE` or `DEBUG=TRUE` enables English choices and resolution in the server features that support it. Set `BLEX_DEFAULT_LANGUAGE=en` with either flag to make English the site default. User-authored content is never translated by these flags.

## Update translations

Run from the repository root after installing workspace dependencies with `pnpm install`:

```sh
pnpm --dir packages/client i18n:extract
# Edit packages/client/src/locales/ko/messages.po
pnpm i18n:check
```

Use existing Lingui macros in React screens. For public SSR/browser copy, call `ui('English source', { placeholders })` with a literal English message. The extractor records its call site and derives a `public.` ID from the source. When changing an established source sentence, pass the original ID as the third argument to preserve its identity. Never pass authored content or a computed source sentence to this helper.

`pnpm i18n:check` fails when a PO catalog is stale or misses a Korean translation, and when the server catalog misses one for a `systemMessage()` or literal `developerText()` call, an English Developer API error, or a title, summary, description, or tag of the generated OpenAPI document. It also compares placeholders.

Keep explicit, domain-prefixed Lingui IDs stable and provide clear English default messages. Preserve placeholders and ICU expressions. Keep PO catalogs under version control; generated Lingui `.mjs` files are ignored.

For server product copy, use `systemMessage('English source', { placeholders })` and add the corresponding `server.` entry to `data/ui-messages.ko.json`. For Developer API reference and error text, call `developerText(locale, 'English source', { placeholders })` or write the English in the schema, and add a `developer.` entry. Keep placeholders intact. Resolve messages when handling the request, not at module initialization; getters or functions keep shared definitions locale-aware. Do the same for public `ui()` calls. Dates displayed to readers must use the request/document locale; machine-readable keys and dates retain their stable formats.

For the reusable editor, update the translations in its type-checked locale files without changing keys or `{placeholders}`. Its [README](../packages/client/src/features/editor/tiptap/README.md) describes catalog loading and host overrides.

## Add a language

- Add its code to `SUPPORTED_LOCALES` in `packages/client/src/i18n/locale.ts` and its catalog loaders in `src/i18n/index.ts`, `src/i18n/screen-catalog.ts`, and `src/features/developer-api/developer-catalog.ts` in the same app.
- Add and translate the PO catalog. The Lingui configuration derives its locales from `SUPPORTED_LOCALES`.
- If used by the reusable editor, add its type-checked message catalog and loader as described in the editor README.
- Add a server catalog beside `packages/server/data/ui-messages.ko.json` and load it in `platform/messages.ts`; the `/v1` fallback catalog needs the language too.
- Update the server's supported languages and release gate in `packages/server/src/platform/locale.ts`, and add any affected message templates. Adding a browser catalog alone does not add server support.
- Verify the affected SSR pages, web screens, notifications, and editor before making the language available to users.

## Notifications and checks

System notifications use stable `message_key` and `message_params` values with fallback content. Add message templates to `notificationText` as `systemMessage()` calls and preserve rendering for existing stored notifications. Treat announcements written by administrators as user-authored content.

Run the web checks in the [Testing Guide](TESTING_GUIDE.md). For changes to server language handling or notifications, also run `pnpm test` and `pnpm type-check`. Test locale selection, interpolation, catalog loading, and critical flows rather than every translated sentence.
