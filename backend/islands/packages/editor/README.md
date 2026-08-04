# @blex/editor

## Localization

`TiptapEditor` has no dependency on the host application's i18n framework. Pass the active UI locale and the editor resolves its own typed catalog:

```tsx
<TiptapEditor locale={i18n.locale} name="content_html" />
```

English is the source and fallback locale. Korean is included as a built-in locale, and only the active non-English catalog is loaded. To add another built-in locale:

1. Copy `src/TiptapEditor/i18n/locales/en.ts`.
2. Translate values without changing keys or `{placeholders}`.
3. Type the catalog as `Record<keyof typeof enEditorMessages, string>` so missing keys fail type-checking.
4. Register its dynamic loader in `src/TiptapEditor/i18n/messages.ts`.

The provider waits for a built-in catalog before mounting the editor, so locale loading does not flash English controls or recreate an initialized editor.

Hosts can support a locale without changing this package by supplying overrides. Unspecified messages safely fall back to English:

```tsx
<TiptapEditor
    locale="fr"
    messages={{ 'code.copy': 'Copier le code' }}
    name="content_html"
/>
```

Visible editor chrome belongs in these catalogs. Post content, template names, captions, alt text, and other authored values must remain untouched.
