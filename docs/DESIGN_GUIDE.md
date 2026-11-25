# Design Guide

This is the design system baseline. Update it only as a deliberate baseline change supported by an established product pattern, not to justify a local UI fix. See the [UI change guide](UI_CHANGE_STYLE_GUIDE.md) for implementation scope.

## Visual language

- Keep the interface minimal so writing and reading remain the focus. Remove elements that do not serve a clear purpose.
- Use semantic `surface`, `content`, `line`, `action`, and state tokens. Avoid hardcoded colors where a semantic token exists, and do not reintroduce legacy color or glass aliases.
- Use `bg-surface`, `bg-surface-page`, and `bg-surface-subtle` for hierarchy; `text-content`, `text-content-secondary`, and `text-content-hint` for emphasis.
- Primary actions use `bg-action`, `text-content-inverted`, and `hover:bg-action-hover`. Reserve success, warning, and danger colors for state.
- Use readable line heights and structural headings without excessive bold weight.

## Spacing and interaction

| Context | Baseline |
| --- | --- |
| Spacing | 8px grid, such as `p-4` and `gap-2` |
| Cards and modals | `rounded-2xl` (16px) |
| Dropdowns and popovers | `rounded-xl` (12px) |
| Buttons and inputs | `rounded-lg` (8px) |
| Tags and badges | `rounded-md` (6px) or `rounded-full` |
| Avatars and indicators | `rounded-full` |
| Interaction transitions | `duration-150`; entrances may use `duration-500` |
| Depth | Subtle borders and `shadow-subtle` |

Use radius to express hierarchy and density. Keep corners within the scale above. Interactive elements need visible hover, focus, and pressed feedback; motion should clarify a transition.

The author's profile card is the one exception to flat surfaces: its cover sits behind it as a slightly rotated print, and both use `shadow-floating`. Keep every other surface flat and do not animate the card on hover, because it is not a control.

Moving between an author's overview and their posts or series carries the avatar between the card and the compact header with a view transition, so the reader sees they stay with the same person. It is the only motion between pages: the rest of the page changes at once, and readers who ask for reduced motion see none.

## Light and dark themes

- Tokens live in `packages/client/src/appearance/variables.css`; the adjacent `tailwind.css` maps them through `@theme inline` for public pages and React screens. Keep color values in the token file.
- Theme uses `html[data-theme="light|dark"]`. Follow system preference until the user chooses a theme; persist that choice in the `blex_theme` cookie. Keep initialization in `packages/client/src/appearance/site-client.ts` early to prevent a mismatched first paint.
- Keep runtime listeners and third-party UIs, including Monaco and charts, synchronized with theme changes.
- Prose and syntax highlighting use their semantic token groups in both themes.

## Mobile and accessibility

- Verify layouts at 375px and desktop widths. Keep reading pages spacious and management screens appropriately dense.
- Provide at least 44×44px touch targets. Increase the hit area of compact controls without making every visible control large.
- Use clear pressed feedback, comfortable menu spacing, and inputs with enough height for touch (`h-12` as the baseline).
- Keep the mobile header focused on search, notifications, and the user menu.
- Verify keyboard focus, readable contrast, and the same screen in light and dark themes.
