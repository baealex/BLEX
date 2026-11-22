# @blex/editor

## Localization

`TiptapEditor` works independently of the host application's i18n framework. Pass the active UI locale to load the editor's type-checked message catalog:

```tsx
<TiptapEditor locale={i18n.locale} name="content_html" />
```

English is the source language and fallback for missing translations. Korean is included as a built-in locale, and only the active non-English catalog is loaded. To add another built-in locale:

1. Copy `src/TiptapEditor/i18n/locales/en.ts`.
2. Translate values without changing keys or `{placeholders}`.
3. Type the catalog as `Record<keyof typeof enEditorMessages, string>` so missing keys fail type-checking.
4. Register its dynamic loader in `src/TiptapEditor/i18n/messages.ts`.

The provider loads the built-in catalog before mounting the editor. This avoids briefly showing English labels or recreating an editor that has already been initialized.

To add translations without changing this package, pass message overrides. Messages without overrides fall back to English:

```tsx
<TiptapEditor
    locale="fr"
    messages={{ 'code.copy': 'Copier le code' }}
    name="content_html"
/>
```

Editor interface labels belong in these catalogs. Post content, template names, captions, alt text, and other authored values must remain untouched.
