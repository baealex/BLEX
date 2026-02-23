# BLEX Design Philosophy

> "Good design is actually a lot harder to notice than poor design, in part because good designs fit our needs so well that the design is invisible." — Donald Norman

## 1. The Soul of the Product

BLEX is not just a tool; it is an environment. We do not impress with complexity; we impress with **restraint**.

### Sophistication through Subtraction
- **Less is Premium**: Every element must fight for its existence. If it doesn't serve a clear purpose, delete it.
- **The "High-End" Detail**: It's about the perfect 8px radius, the subtle border (`color-line`), and the way a button presses down when clicked.

### It Must Feel "Alive"
- **Motion is Meaning**: Nothing just "appears". It fades in, slides up, or scales. `duration-150` for interactions, `duration-500` for entrances.
- **Tangible Feedback**: When clicked, it must *feel* clicked. A lack of feedback is a broken promise.

---

## 2. The "Beacon" Rule

This document is the **minimum standard**, not the maximum limit.

> **If you see a component in the codebase that feels better than what is described here, follow that. Then update this document.**

We evolve by copying our best work, then making it the new baseline.

---

## 3. Visual Language

Our aesthetic is **Minimalism** meets **Boldness**.

### The Palette of Restraint

> **"Content is the only color. Everything else whispers."**

We use **Monochrome** because user content must be the star. Our interface is the stage, not the performer.

- **Token-First**: Always use semantic tokens (`surface/content/line/action/state`), never hardcoded hex or legacy aliases.
- **Surface**: `bg-surface`, `bg-surface-page`, `bg-surface-subtle` define hierarchy in both light and dark.
- **Action**: `bg-action` + `text-content-inverted` for primary actions, with `bg-action-hover` on hover.
- **Hierarchy**: `text-content`, `text-content-secondary`, `text-content-hint` guide the eye consistently across themes.
- **Accent**: State tokens only (`color-success`, `color-warning`, `color-danger`).

### Typography
- **Readability is Luxury**: Use generous line heights (`leading-relaxed`).
- **Headings**: Semantic and structural. Avoid excessive bold weights.

---

## 4. Interaction Patterns

Consistency creates comfort. Use these as your baseline.

### Essential Tokens

| Context | Value | Tailwind | Why |
|:---|:---|:---|:---|
| **Radius** | 6-16px | `rounded-md` to `rounded-2xl` | Scale with information density |
| **Duration** | 150ms | `duration-150` | Crisp, not sluggish |
| **Space** | 8px Grid | `p-4`, `gap-2` | Everything aligns |
| **Shadow** | Subtle | `border border-line` + `shadow-subtle` | Depth without drama |

### Radius as Intent, Not Size

Radius signals **information density** and **hierarchy**, not just visual weight.

- **Cards, Modals** (`rounded-2xl` / 16px): High information density. Needs substance to hold attention.
- **Dropdowns, Popovers** (`rounded-xl` / 12px): Focused context. Balanced refinement.
- **Buttons, Inputs** (`rounded-lg` / 8px): Instant action. Crisp and confident.
- **Tags, Badges** (`rounded-md` / 6px or `rounded-full`): Low priority. Subtle or playful.
- **Avatars, Indicators** (`rounded-full`): Identity. Always circular.

*Why stop at 16px?* Beyond this, corners compete with content. We want sophisticated, not decorative.

### Component Vibe Checks

**The Button**
*Does it feel solid?*
`bg-action` with `hover:bg-action-hover` and `text-content-inverted`. It anchors the page.

**The Card**
*Does it feel real?*
`border border-line bg-surface-subtle` with soft hover transition. It frames, never cages.

**The Action**
*Did I acknowledge the user?*
Every interactive element needs `:active` state (`active:scale-95`).

---

## 5. Theme System (Light/Dark)

Dark mode is not an optional skin. It is a first-class rendering mode.

### Single Source of Truth

- **Token values live only in** `backend/islands/apps/remotes/styles/variables.css`.
- **Tailwind mapping lives in** `backend/islands/apps/remotes/styles/tailwind.css` and must stay mapping-only (`@theme inline`), not duplicate token values.
- Legacy aliases (`--color-bg-*`, `--color-text-*`, `--color-border-*`, `--color-interactive-*`, `--glass-*`) are deprecated and must not be reintroduced.

### Theme Activation and Persistence

- Theme is applied via `html[data-theme="light|dark"]`.
- Default follows system preference when no explicit user choice exists.
- User override is stored in cookie key `blex_theme`.
- Server must read cookie and set initial `data-theme` at render time to prevent first-paint mismatch.
- Client theme changes must update `data-theme` and keep runtime listeners in sync.

### Component Rules for Dark Mode

- No hardcoded color classes (`gray-*`, `black`, `white`) in product UI where semantic tokens exist.
- Prose styles must use prose tokens (`--color-prose-*`), not hardcoded link/blockquote colors.
- Syntax highlighting must use code tokens (`--color-code-*`) and support dark values.
- Third-party UIs (e.g. Monaco, charts) must switch native theme mode on theme change.

---

## 6. Mobile First (For Real)

Mobile is not a "version". It is *the* version.

> "On mobile, every pixel is precious, every tap is intentional, and every hesitation is a failure."

### Touch Demands Substance

- **Touch is Commitment**: Minimum 44×44px touch targets. Tiny targets are betrayals.
- **Feedback is Respect**: Buttons must press down (`active:scale-95`, `active:bg-surface-subtle`).
- **Space is Generosity**: Use `py-3` for menu items, `gap-3` for icons. Let the thumb land safely.

### Mobile Vibe Checks

**The Dropdown**
*Can I tap without hesitation?*
`py-3` feels safe. `py-2` feels risky.

**The Header**
*Is it calm?*
Collapse to essentials: search, notifications, user menu.

**The Input**
*Does it want my text?*
`h-12` minimum. If it feels timid, make it taller.

---

## 7. Checklist for Greatness

Before calling it "done":
1. **Is it minimal?** Can I remove one more element?
2. **Does it breathe?** Enough whitespace?
3. **Is it smooth?** Did that modal glide or jerk?
4. **Does it work on mobile?** Test at 375px width.
5. **Does it render correctly in both themes?** Verify light and dark for the same screen.
6. **Would I ship this?** If it feels "janky", fix it.
