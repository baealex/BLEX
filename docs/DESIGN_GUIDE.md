# BLEX Design Philosophy

> "Good design is actually a lot harder to notice than poor design, in part because good designs fit our needs so well that the design is invisible." — Donald Norman

## 1. The Soul of the Product

BLEX is not just a tool; it is an environment. Our users should feel a sense of calm and clarity when they enter. We do not impress with complexity; we impress with **restraint**.

### Sophistication through Subtraction
- **Less is Premium**: Every element on the screen must fight for its existence. If it doesn't serve a clear purpose, delete it.
- **The "High-End" Detail**: It's not about big features. It's about the perfect 8px radius, the subtle border color (gray-900/5), and the way a button presses down when clicked. Use whitespace courageously.

### It Must Feel "Alive"
- **Motion is Meaning**: Nothing should just "appear". It should fade in, slide up, or scale. Use `duration-150` for crisp interactions and `duration-500` for dramatic entrances.
- **Tangible Feedback**: When a user clicks a button, it must *feel* clicked (scale down, change color). A lack of feedback is a broken promise.

---

## 2. The "Beacon" Rule (The Ceiling, Not the Floor)

This document is the **minimum standard**, not the maximum limit.

> **If you see a screen or component in the codebase that looks or feels better than what is described here, follow that.**

Your goal is to raise the bar. If the design guide says "use gray-100" but you see a new module using a stunning `gray-50/50` backdrop with a `backdrop-blur`, adopt the superior pattern. We evolve by copying our best work.

---

## 3. Visual Language

Our aesthetic is **Minimalism** meets **Boldness**.

### The Palette of Restraint
We primarily use **Monochrome**. Color is precious; use it only for warnings (Red) or critical focus.
- **Surface**: Pure White (`bg-white`) for focus, subtle Grays (`bg-gray-50`) for structure.
- **Action**: Deep Black (`bg-gray-900`) for primary actions. It commands attention without shouting.
- **Hierarchy**: Use text shades (`gray-900`, `gray-600`, `gray-400`) to guide the eye. Never use pure black (#000) for text; it causes eye strain.

### Typography
- **Readability is Luxury**: Use generous line heights (`leading-relaxed`).
- **Headings**: Semantic and structural. Do not use bold weights excessively.

---

## 4. Interaction Patterns (Reference)

While we prioritize feeling, consistency creates comfort. Use these values as your baseline.

### Essential Tokens

| Context | Value | Tailwind Class | Note |
|:---|:---|:---|:---|
| **Radius** | 8px / 12px | `rounded-lg` / `rounded-xl` | Buttons / Cards. Soft but structured. |
| **Duration** | 150ms | `duration-150` | Micro-interactions (hover, click). |
| **Space** | 8px Grid | `p-4`, `gap-2` | Everything aligns to 8px. |
| **Shadow** | Subtle | `ring-1 ring-gray-900/5` | Prefer rings over heavy drop shadows. |

### Component "Vibe" Checks

**The Primary Button**
*Does it feel solid?*
It should be `bg-gray-900` text-white. On hover, it lightens slightly (`bg-gray-800`). It is the anchor of the page.

**The Card**
*Does it feel like a physical object?*
It needs a subtle border (`ring-1 ring-gray-900/5`) and a soft background transition on hover. It frames content, it doesn't cage it.

**The Action**
*Did I acknowledge the user?*
Every `<button>` needs a `:active` state (e.g., `active:scale-95`).

---

## 5. Checklist for Greatness

Before considering a task "done", ask:
1.  **Is it minimal?** Can I remove one more line or border?
2.  **Does it breathe?** Is there enough whitespace?
3.  **Is it smooth?** Did that modal open abruptly, or did it glide continuously?
4.  **Would ship this?** If it feels "janky" or "dev-art", fix it.
