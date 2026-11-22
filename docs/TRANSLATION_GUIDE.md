# Translation Guide

Keep product messages separate from posts, profile text, tags, queries, and other user-authored content. Preserve authored content exactly as written.

## Current coverage

The additional React screens use Lingui, and the reusable editor has a typed catalog. Many main-app SSR pages still contain Korean copy directly in `packages/server/src/`; they do not share a complete server translation catalog. Enabling English does not make every page English.

| Surface | Messages and locale handling |
| --- | --- |
| Web screens | `packages/web/src/locales/{locale}/messages.po`; host locale supplied by `packages/server/src/application/screen-host/index.tsx` |
| Reusable editor | `packages/editor/src/TiptapEditor/i18n/locales/{locale}.ts` |
| System notifications | Message keys, parameters, and text templates in `packages/server/src/features/notifications/model.ts` |
| Main app pages and API fallback text | Owning modules in `packages/server/src/`; check their existing language handling before editing |

English is the source language for catalogs. Korean and English catalogs are included. The web runtime reads `window.configuration.locale`, falling back to the document language; it does not choose a separate locale from `navigator.language`.

`ENABLE_ENGLISH_UI=TRUE` enables English in supported server paths. Regional preference choices also expose English when `DEBUG=TRUE`. These flags do not provide full UI translation coverage.

## Update translations

Run from the repository root after installing workspace dependencies with `pnpm install`:

```sh
pnpm --dir packages/web i18n:extract
# Edit packages/web/src/locales/ko/messages.po
pnpm i18n:check
```

Keep explicit, domain-prefixed Lingui IDs stable and use complete English defaults. Preserve placeholders and ICU expressions. Track PO catalogs; generated Lingui `.mjs` files are ignored.

For the reusable editor, edit the typed locale values without changing keys or `{placeholders}`. Its [README](../packages/editor/README.md) describes catalog loading and host overrides. The main app's visual editor in `packages/server/src/features/posts/editor/` is a separate implementation.

## Add a language

- Add its code to `SUPPORTED_LOCALES` in `packages/web/src/i18n/locale.ts` and its catalog loader in `src/i18n/index.ts` in the same app.
- Add and translate the PO catalog. The Lingui configuration derives its locales from `SUPPORTED_LOCALES`.
- If used by the reusable editor, add its typed catalog and loader as described in the editor README.
- Update the server's supported language choices and selection paths in `packages/server/src/features/account/services/regional.ts`, `packages/server/src/features/auth/account-validation.ts`, and any affected message handlers. Adding a browser catalog alone does not add server support.
- Verify the affected SSR pages, web screens, notifications, and editor before exposing the language to users.

## Notifications and checks

System notifications use stable `message_key` and `message_params` values with fallback content. Add templates through `notificationText` and preserve rendering for existing stored notifications. Administrator-authored announcements remain content.

Run the web checks in [Testing Guide](TESTING_GUIDE.md). For changes to server language handling or notifications, also run `pnpm test` and `pnpm type-check`. Test locale selection, interpolation, catalog loading, and critical flows rather than every translated sentence.
