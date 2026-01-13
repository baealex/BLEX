# BLEX Design Philosophy

> "Good design is actually a lot harder to notice than poor design, in part because good designs fit our needs so well that the design is invisible." — Donald Norman

## 1. The Soul of the Product

BLEX is not just a tool; it is an environment. We do not impress with complexity; we impress with **restraint**.

### Sophistication through Subtraction
- **Less is Premium**: Every element must fight for its existence. If it doesn't serve a clear purpose, delete it.
- **The "High-End" Detail**: It's about the perfect 8px radius, the subtle border (gray-900/5), and the way a button presses down when clicked.

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

- **Surface**: Pure White (`bg-white`) for focus, subtle Grays (`bg-gray-50`) for structure.
- **Action**: Deep Black (`bg-gray-900`) for primary actions. It commands without shouting.
- **Hierarchy**: Text shades (`gray-900`, `gray-600`, `gray-400`) guide the eye. Never pure black (#000)—it causes eye strain.
- **Accent**: Red for warnings. That's it.

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
| **Shadow** | Subtle | `ring-1 ring-gray-900/5` | Depth without drama |

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
`bg-gray-900` with `hover:bg-gray-800`. It anchors the page.

**The Card**
*Does it feel real?*
`ring-1 ring-gray-900/5` with soft hover transition. It frames, never cages.

**The Action**
*Did I acknowledge the user?*
Every interactive element needs `:active` state (`active:scale-95`).

---

## 5. Mobile First (For Real)

Mobile is not a "version". It is *the* version.

> "On mobile, every pixel is precious, every tap is intentional, and every hesitation is a failure."

### Touch Demands Substance

- **Touch is Commitment**: Minimum 44×44px touch targets. Tiny targets are betrayals.
- **Feedback is Respect**: Buttons must press down (`active:scale-95`, `active:bg-gray-100`).
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

## 6. Checklist for Greatness

Before calling it "done":
1. **Is it minimal?** Can I remove one more element?
2. **Does it breathe?** Enough whitespace?
3. **Is it smooth?** Did that modal glide or jerk?
4. **Does it work on mobile?** Test at 375px width.
5. **Would I ship this?** If it feels "janky", fix it.
