# BLEX Design Philosophy

> **Do not casually edit this document.**
>
> This is the design system source of truth, not a scratchpad for a single UI fix.
> Do not change these rules while implementing a feature just to justify local code.
> Update this document only when the existing product already proves a better pattern and the change is intentionally accepted as a new baseline.

> "Good design is actually a lot harder to notice than poor design, in part because good designs fit our needs so well that the design is invisible." — Donald Norman

## 1. Design principles

Keep the interface focused and restrained. Add complexity only when it serves a clear purpose.

### Keep the interface simple
- **Remove unnecessary elements**: Keep only elements that serve a clear purpose.
- **Pay attention to details**: Details such as an 8px corner radius, a subtle border (`color-line`), and a clear pressed state make the interface feel polished.

### Give clear feedback
- **Use purposeful motion**: Animate entrances with a fade, slide, or scale transition. `duration-150` for interactions, `duration-500` for entrances.
- **Acknowledge interactions**: Give controls a visible pressed state so users can tell that a click or tap registered.

---

## 2. Follow proven patterns

This document is the **minimum standard**, not the maximum limit.

> **If you see a component in the codebase that feels better than what is described here, follow that. Then update this document.**

Build on the strongest patterns already used in the product, then adopt them as the new baseline.

---

## 3. Visual language

Use a minimal interface with a clear visual hierarchy.

### Color palette

> **"Content is the only color. Everything else whispers."**

Use a mostly monochrome interface so user content remains the focus.

- **Token-First**: Always use semantic tokens (`surface/content/line/action/state`), never hardcoded hex or legacy aliases.
- **Surface**: `bg-surface`, `bg-surface-page`, `bg-surface-subtle` define hierarchy in both light and dark.
- **Action**: `bg-action` + `text-content-inverted` for primary actions, with `bg-action-hover` on hover.
- **Hierarchy**: `text-content`, `text-content-secondary`, `text-content-hint` guide the eye consistently across themes.
- **Accent**: State tokens only (`color-success`, `color-warning`, `color-danger`).

### Typography
- **Prioritize readability**: Use generous line heights (`leading-relaxed`).
- **Headings**: Semantic and structural. Avoid excessive bold weights.

---

## 4. Interaction patterns

Consistency creates comfort. Use these as your baseline.

### Design tokens

| Context | Value | Tailwind | Why |
|:---|:---|:---|:---|
| **Radius** | 6-16px | `rounded-md` to `rounded-2xl` | Scale with information density |
| **Duration** | 150ms | `duration-150` | Responsive feedback |
| **Space** | 8px Grid | `p-4`, `gap-2` | Consistent alignment |
| **Shadow** | Subtle | `border border-line` + `shadow-subtle` | Subtle depth |

### Choose corner radii by context

Radius signals **information density** and **hierarchy**, not just visual weight.

- **Cards, Modals** (`rounded-2xl` / 16px): High information density and clear visual grouping.
- **Dropdowns, Popovers** (`rounded-xl` / 12px): Focused content within a smaller surface.
- **Buttons, Inputs** (`rounded-lg` / 8px): Controls for immediate actions.
- **Tags, Badges** (`rounded-md` / 6px or `rounded-full`): Secondary labels and status information.
- **Avatars, Indicators** (`rounded-full`): Identity elements; use circular shapes.

Keep the standard corner-radius scale within 6–16px so corners do not distract from the content.

### Component checks

**The Button**
*Is the primary action easy to identify?*
`bg-action` with `hover:bg-action-hover` and `text-content-inverted`. This makes the primary action stand out.

**The Card**
*Is the content grouped clearly?*
`border border-line bg-surface-subtle` with a subtle hover transition. Use the border and surface to group content without dominating it.

**The Action**
*Does the interaction provide feedback?*
Every interactive element needs an `:active` state (`active:scale-95`).

---

## 5. Light and dark themes

Treat dark mode as a supported rendering mode throughout the interface.

### Token files

- Tokens and Tailwind mappings live in `packages/server/src/appearance/variables.css` and `packages/server/src/appearance/tailwind.css`.
- That one stylesheet covers public pages and React screens. It scans `packages/server`, `packages/client`, `packages/client/src/ui`, and `packages/client/src/features/editor/tiptap` for class names.
- Tailwind mappings must stay mapping-only (`@theme inline`), not duplicate token values.
- Legacy aliases (`--color-bg-*`, `--color-text-*`, `--color-border-*`, `--color-interactive-*`, `--glass-*`) are deprecated and must not be reintroduced.

### Applying and saving the theme

- Theme is applied via `html[data-theme="light|dark"]`.
- Default follows system preference when no explicit user choice exists.
- User override is stored in cookie key `blex_theme`.
- The shared theme client in `packages/server/src/appearance/site-client.ts` reads the cookie or system preference and sets `data-theme`. Keep initialization early to avoid a visible theme mismatch.
- Client theme changes must update `data-theme` and keep runtime listeners in sync.

### Dark mode in components

- No hardcoded color classes (`gray-*`, `black`, `white`) in product UI where semantic tokens exist.
- Prose styles must use prose tokens (`--color-prose-*`), not hardcoded link/blockquote colors.
- Syntax highlighting must use code tokens (`--color-code-*`) and support dark values.
- Third-party UIs (e.g. Monaco, charts) must switch native theme mode on theme change.

---

## 6. Mobile first

Design for mobile from the start.

> "On mobile, every pixel is precious, every tap is intentional, and every hesitation is a failure."

### Touch targets and spacing

- **Touch targets**: Provide a minimum tappable area of 44×44px.
- **Pressed states**: Buttons must respond visibly to taps (`active:scale-95`, `active:bg-surface-subtle`).
- **Spacing**: Use `py-3` for menu items and `gap-3` for icons to make them easy to tap.

### Mobile checks

**The Dropdown**
*Are items easy to tap?*
`py-3` feels safe. `py-2` feels risky.

**The Header**
*Does it show only the essential controls?*
Collapse to essentials: search, notifications, user menu.

**The Input**
*Is it easy to focus and type?*
`h-12` minimum. Increase the height if the field is difficult to tap.

---

## 7. Design review checklist

Before finishing a design change:
1. **Is it minimal?** Can I remove one more element?
2. **Is there enough whitespace?**
3. **Is it smooth?** Did that modal glide or jerk?
4. **Does it work on mobile?** Test at 375px width.
5. **Does it render correctly in both themes?** Verify light and dark for the same screen.
6. **Does it feel finished?** Resolve rough or inconsistent interactions.
