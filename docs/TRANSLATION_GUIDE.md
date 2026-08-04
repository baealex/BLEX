# Translation Guide

BLEX keeps product copy translatable while preserving posts, profile text, tags,
search queries, and other user-authored content exactly as written.

English is the source language. Translators normally edit PO catalogs only; they
do not need to change Django templates or React components.

## Catalog ownership

BLEX has two catalogs because its server-rendered pages and React islands are
built by different runtimes:

- Django templates, validation, and server messages:
  `backend/src/locale/{locale}/LC_MESSAGES/django.po`
- React islands:
  `backend/islands/apps/remotes/src/locales/{locale}/messages.po`

Do not merge these catalogs or copy messages between them. A message belongs to
the runtime that renders it.

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
5. Run the extraction and compile checks for both runtimes.
6. Verify one server-rendered page and one island page in the new locale before
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
