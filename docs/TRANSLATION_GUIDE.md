# Translation Guide

Keep product messages separate from posts, profile text, tags, queries, and other user-authored content. Preserve authored content exactly as written.

## Current coverage

Public pages and client-rendered React screens share the Lingui catalogs. Authentication, navigation, generated status messages, dates, and number formatting follow the selected UI language. The reusable editor keeps its type-checked catalog. Posts, profile text, site descriptions, notices, and other authored content remain in their original language. Unstructured historical notification content is also retained as written.

| Surface | Messages and locale handling |
| --- | --- |
| Web screens | `packages/client/src/locales/{locale}/messages.po`; host locale supplied by `packages/server/src/application/screen-host/index.ts` |
| Reusable editor | `packages/client/src/features/editor/tiptap/TiptapEditor/i18n/locales/{locale}.ts` |
| System notifications | Message keys, parameters, and text templates in `packages/server/src/features/notifications/model.ts` |
| Shared header and quick search | Typed `siteText()` messages in `packages/client/src/appearance/messages.ts`, using the supplied document locale |
| Public SSR and browser UI | `ui()` in `packages/client/src/i18n/public-ui.ts`, extracted into the same PO catalogs by `scripts/public-ui-extractor.mjs` |
| Server product messages | English sources in `systemMessage()` calls; Korean translations in `packages/server/data/ui-messages.ko.json`; existing API fallback catalog in `data/api-messages.ko.json` |
| Developer API documentation | Typed English source messages and Korean translations under `features/developer-api/locales/ko.ts` in the client and server; schema metadata is translated on a copy, preserving API names, enums, defaults, and examples |

English is the source language for catalogs. Korean and English catalogs are included. The web runtime reads the server-supplied document language, falling back to `window.configuration.locale`; it does not choose a separate locale from `navigator.language`.

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

Keep explicit, domain-prefixed Lingui IDs stable and provide clear English default messages. Preserve placeholders and ICU expressions. Keep PO catalogs under version control; generated Lingui `.mjs` files are ignored.

For server product copy, use `systemMessage('English source', { placeholders })` and add the corresponding `server.` entry to `data/ui-messages.ko.json`. Keep placeholders intact. Resolve messages when handling the request, not at module initialization; getters or functions keep shared definitions locale-aware. Do the same for public `ui()` calls. Dates displayed to readers must use the request/document locale; machine-readable keys and dates retain their stable formats.

For the reusable editor, update the translations in its type-checked locale files without changing keys or `{placeholders}`. Its [README](../packages/client/src/features/editor/tiptap/README.md) describes catalog loading and host overrides.

## Add a language

- Add its code to `SUPPORTED_LOCALES` in `packages/client/src/i18n/locale.ts` and its catalog loader in `src/i18n/index.ts` in the same app.
- Add and translate the PO catalog. The Lingui configuration derives its locales from `SUPPORTED_LOCALES`.
- If used by the reusable editor, add its type-checked message catalog and loader as described in the editor README.
- Register the locale and its messages in the typed shared-header and Developer API catalogs as well.
- Update the server's supported languages and release gate in `packages/server/src/platform/locale.ts`, and add any affected message templates. Adding a browser catalog alone does not add server support.
- Verify the affected SSR pages, web screens, notifications, and editor before making the language available to users.

## Notifications and checks

System notifications use stable `message_key` and `message_params` values with fallback content. Add message templates to `notificationText` and preserve rendering for existing stored notifications. Treat announcements written by administrators as user-authored content.

Run the web checks in the [Testing Guide](TESTING_GUIDE.md). For changes to server language handling or notifications, also run `pnpm test` and `pnpm type-check`. Test locale selection, interpolation, catalog loading, and critical flows rather than every translated sentence.
