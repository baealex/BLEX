# Translation Guide

Keep product messages separate from posts, profile text, tags, queries, and other user-authored content. Preserve authored content exactly as written.

## Current coverage

The client-rendered React screens use Lingui, and the reusable editor has a type-checked message catalog. Many server-rendered pages still contain Korean text directly in `packages/client/src/routes/` and the views they use; there is no complete translation catalog for server-rendered pages. Enabling English does not translate every page.

| Surface | Messages and locale handling |
| --- | --- |
| Web screens | `packages/client/src/locales/{locale}/messages.po`; host locale supplied by `packages/server/src/application/screen-host/index.ts` |
| Reusable editor | `packages/client/src/features/editor/tiptap/TiptapEditor/i18n/locales/{locale}.ts` |
| System notifications | Message keys, parameters, and text templates in `packages/server/src/features/notifications/model.ts` |
| Main app pages | `packages/client/src/routes/` and `packages/client/src/features/`; API fallback text stays in `packages/server/src/`; check their existing language handling before editing |

English is the source language for catalogs. Korean and English catalogs are included. The web runtime reads `window.configuration.locale`, falling back to the document language; it does not choose a separate locale from `navigator.language`.

`ENABLE_ENGLISH_UI=TRUE` enables English in the server features that support it. English also appears in the regional settings language selector when `DEBUG=TRUE`. These flags do not provide full UI translation coverage.

## Update translations

Run from the repository root after installing workspace dependencies with `pnpm install`:

```sh
pnpm --dir packages/client i18n:extract
# Edit packages/client/src/locales/ko/messages.po
pnpm i18n:check
```

Keep explicit, domain-prefixed Lingui IDs stable and provide clear English default messages. Preserve placeholders and ICU expressions. Keep PO catalogs under version control; generated Lingui `.mjs` files are ignored.

For the reusable editor, update the translations in its type-checked locale files without changing keys or `{placeholders}`. Its [README](../packages/client/src/features/editor/tiptap/README.md) describes catalog loading and host overrides.

## Add a language

- Add its code to `SUPPORTED_LOCALES` in `packages/client/src/i18n/locale.ts` and its catalog loader in `src/i18n/index.ts` in the same app.
- Add and translate the PO catalog. The Lingui configuration derives its locales from `SUPPORTED_LOCALES`.
- If used by the reusable editor, add its type-checked message catalog and loader as described in the editor README.
- Update the server's supported language choices and selection paths in `packages/server/src/features/account/services/regional.ts`, `packages/server/src/features/auth/account-validation.ts`, and any affected message handlers. Adding a browser catalog alone does not add server support.
- Verify the affected SSR pages, web screens, notifications, and editor before making the language available to users.

## Notifications and checks

System notifications use stable `message_key` and `message_params` values with fallback content. Add message templates to `notificationText` and preserve rendering for existing stored notifications. Treat announcements written by administrators as user-authored content.

Run the web checks in the [Testing Guide](TESTING_GUIDE.md). For changes to server language handling or notifications, also run `pnpm test` and `pnpm type-check`. Test locale selection, interpolation, catalog loading, and critical flows rather than every translated sentence.
