# Translation Guide

BLEX keeps product copy translatable while preserving posts, profile text, tags,
search queries, and other user-authored content exactly as written.

English is the source language. Translators normally edit PO catalogs rather
than Django templates or React components. The reusable editor package keeps a
small typed catalog of its own so it is not coupled to the host application's
i18n framework.

## Catalog ownership

BLEX has three catalog surfaces because its server-rendered pages, React
islands, and reusable editor package have different runtime boundaries:

- Django templates, validation, and server messages:
  `backend/src/locale/{locale}/LC_MESSAGES/django.po`
- React islands:
  `backend/islands/apps/remotes/src/locales/{locale}/messages.po`
- Rich-text editor controls:
  `backend/islands/packages/editor/src/TiptapEditor/i18n/locales/{locale}.ts`

Do not merge these catalogs or copy messages between them. A message belongs to
the runtime that renders it. Editor locale files are type-checked against the
English key set, and only the active non-English catalog is loaded.

## Update an existing translation

For Django messages:

```bash
node scripts/manage.mjs makemessages -l ko --ignore=mvenv --no-wrap
# Edit backend/src/locale/ko/LC_MESSAGES/django.po
npm run server:compilemessages
```

Commit both `django.po` and the compiled `django.mo` file.

For React island messages:

```bash
pnpm --dir backend/islands/apps/remotes i18n:extract
# Edit backend/islands/apps/remotes/src/locales/ko/messages.po
npm run islands:i18n:check
```

Commit the PO catalogs. Compiled Lingui `.mjs` files are generated locally and
ignored by Git.

For editor messages, translate the values in the locale's typed catalog without
changing keys or `{placeholders}`, then run the island tests and type checks.

## Add a language

Use a supported BCP 47 language code, such as `fr` or `de`.

1. Add the language to `SUPPORTED_UI_LANGUAGES` in
   `backend/src/main/settings.py` and define an intentional production release
   gate.
2. Generate its Django catalog with `makemessages -l {locale}`.
3. Add the locale to `SUPPORTED_LOCALES` in
   `backend/islands/apps/remotes/src/i18n/locale.ts`.
4. Add its lazy catalog import in
   `backend/islands/apps/remotes/src/i18n/index.ts`.
5. Copy the editor's `en.ts` catalog, translate its values, and register the new
   dynamic loader in `backend/islands/packages/editor/src/TiptapEditor/i18n/messages.ts`.
6. Run the extraction and compile checks for every runtime.
7. Verify one server-rendered page, one island page, and the editor in the new locale before
   enabling it in production.

The Lingui configuration and browser configuration type derive their locale
lists from `SUPPORTED_LOCALES`, so they do not need a separate update.

## Translation rules

- Preserve placeholders exactly: `%(query)s`, `{username}`, and ICU plural
  expressions are part of the message contract.
- Translate complete sentences. Do not assemble translated grammar from small
  fragments.
- Keep explicit Lingui IDs stable. Changing an ID creates a new message.
- Do not translate brand names, URLs, code, or user-authored content unless the
  product explicitly introduces translated content variants.
- Read the result in context. Automated checks catch missing or invalid
  messages, but they cannot judge tone or natural wording.

## Persisted notifications

Do not store a completed, localized sentence for a system-generated
notification. Store its stable message key and interpolation parameters through
`create_system_notify`; the notification is rendered in the active language
when it is read or delivered. Add new templates to
`NotificationMessageService` using an English source sentence.

Admin-authored announcements and welcome messages are content, not product
copy. Continue to store and display them exactly as written through
`create_notify`. Existing unstructured notifications also remain unchanged as
fallback content.

## Required checks

```bash
npm run server:compilemessages
npm run islands:i18n:check
npm run islands:test
npm run islands:lint
npm run islands:type-check
```

Run a focused Django test for the changed page. Do not add a test for every
translated sentence; cover locale negotiation, catalog wiring, interpolation,
and critical user flows instead.
