# Design Guide

This is the design system baseline. Update it only as a deliberate baseline change supported by an established product pattern, not to justify a local UI fix. See the [UI change guide](UI_CHANGE_STYLE_GUIDE.md) for implementation scope.

## Visual language

- Keep the interface minimal so writing and reading remain the focus. Remove elements that do not serve a clear purpose.
- Use semantic `surface`, `content`, `line`, `action`, and state tokens. Avoid hardcoded colors where a semantic token exists, and do not reintroduce legacy color or glass aliases.
- Use `bg-surface`, `bg-surface-page`, and `bg-surface-subtle` for hierarchy; `text-content`, `text-content-secondary`, and `text-content-hint` for emphasis.
- Primary actions use `bg-action`, `text-content-inverted`, and `hover:bg-action-hover`. Reserve success, warning, and danger colors for state.
- Use readable line heights and structural headings without excessive bold weight.
- Text uses Pretendard Variable, which BLEX serves itself as Pretendard's dynamic subset: a page downloads only the pieces that hold its characters, and text shows in the system font until they arrive. `packages/client/styles/fonts/pretendard/` holds `pretendardvariable-dynamic-subset.css` and `woff2-dynamic-subset/` from the `pretendard` package's `dist/web/variable`, unchanged, with its license; to update them, copy them again.

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

The author's profile card and the bottom bars described below are the only exceptions to flat surfaces. The card's cover sits behind it as a slightly rotated print, and both use `shadow-floating`. An author without a cover gets the same print filled with their avatar, enlarged and blurred, so every profile has the same shape in its owner's colors. Keep every other surface flat and do not animate the card on hover, because it is not a control.

Moving between an author's overview and their posts or series carries the avatar between the card and the compact header with a view transition, so the reader sees they stay with the same person. It is the only motion between pages: the rest of the page changes at once, and readers who ask for reduced motion see none.

Bars that float at the bottom of the window, the post's actions and every editor's save bar, share one opaque white pill: `floating-bar-surface`, a hairline ring, a low shadow, and `FloatingBarDivider` between groups. Text never shows through them. The pill reads as a drop of water lit from the upper left, where the eye assumes light comes from: a crisp reflection pools in that curve, light catches the rim there and echoes at the lower right, and the light passing through gathers at the bottom. Keep the reflection sharp-edged and small, because soft, broad light reads as frosted glass, and keep the light source in that corner, because light from another side makes the bar look dented. The bar is the only glossy surface. An icon with a count keeps 8px between them and 16px of padding, so it does not crowd the rounded end. The translucent glass surface is only for small menus inside the editor.

An author's tabs share one narrow column, so the header and avatar stay put between them. A series page is the contents page of its posts, so it uses the post's grid and heading spacing instead: stepping from it into a post keeps the eyebrow, title, and byline in place. Lists of posts or series inside it use the shared row in `packages/client/src/features/discovery/list-rows.tsx`: title, a one-line summary on wide screens, quiet details, and an optional image on the right. Add a new list with that row rather than another card or row style. A series row uses the bundle cover, two outlined sheets behind the cover, and counts its parts, so a series never reads as a single post however many parts it has.

## Light and dark themes

- Tokens live in `packages/client/src/appearance/variables.css`; the adjacent `tailwind.css` maps them through `@theme inline` for public pages and React screens. Keep color values in the token file.
- Theme uses `html[data-theme="light|dark"]`. Follow system preference until the user chooses a theme; persist that choice in the `blex_theme` cookie. `packages/server/public/theme-init.js` applies the theme from the head before the stylesheet, so the first paint already matches; `packages/client/src/appearance/site-client.ts` keeps it in sync afterwards. Change both together.
- Keep runtime listeners and third-party UIs, including Monaco and charts, synchronized with theme changes.
- Prose and syntax highlighting use their semantic token groups in both themes.

## Mobile and accessibility

- Verify layouts at 375px and desktop widths. Keep reading pages spacious and management screens appropriately dense.
- Provide at least 44×44px touch targets. Increase the hit area of compact controls with `touch-target` (on a positioned element) instead of making every visible control large, and keep neighbors' areas from overlapping.
- Use clear pressed feedback, comfortable menu spacing, and inputs with enough height for touch (`h-12` as the baseline).
- Keep the mobile header focused on search, notifications, and the user menu.
- Every control the keyboard reaches shows the shared `:focus-visible` ring from `tailwind.css`. Change its shape when needed, but never remove it or replace it with a faint ring; text fields use a 1px `content-hint` ring and border instead, and borderless writing fields, such as a post's title and body, show only the caret.
- Name every dialog with `aria-labelledby`, mark the current page with `aria-current`, and smooth-scroll only through `scrollBehavior()` so reduced motion is respected.
- Give a popup the role its keys answer. A menu of actions opens onto its first item and answers the arrow keys, Home, End, and Esc; a search box with suggestions is a combobox whose arrows highlight rows while focus stays in the box; a popup of links that Tab walks through is a plain disclosure that marks the current choice with `aria-current`. Esc returns focus to the control that opened the popup.
- Inside the translucent editor menus, hover and selection use `bg-floating-glass-hover`; the subtle surface disappears there in dark mode.
- Verify keyboard focus, readable contrast, and the same screen in light and dark themes.
