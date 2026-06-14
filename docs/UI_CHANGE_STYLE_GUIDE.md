# UI Change Style Guide

This guide is separate from `DESIGN_GUIDE.md`.

`DESIGN_GUIDE.md` defines how BLEX should feel. This document defines how agents should change UI code without turning a small design fix into a system rewrite.

Do not update `DESIGN_GUIDE.md` during ordinary UI implementation.

The design system is not evidence that your local change is correct. The product must prove the pattern first. Only then may the design system be updated as a deliberate baseline change.

## Prime Rule

Make the smallest change that improves the current screen.

If a UI change requires broad token work, shared component rewrites, or new global CSS, stop and prove that the scope is actually necessary.

## Default Order

1. Read the current screen and identify what already works.
2. Copy the best existing local pattern in the same area.
3. Prefer Tailwind utilities at the call site.
4. Use an existing shared component only when it already fits.
5. Extract a helper only after the same structure appears at least three times with the same role, behavior, and state model.
6. Add or change tokens only when multiple independent surfaces need the same semantic value.

## What Goes Where

Use Tailwind for screen-level layout and one-off visual tuning.

Use React shared components for stable product primitives:

- Button
- Input
- Toggle
- Modal
- Dropdown
- Tabs or segmented controls with real repeated behavior

Use `main.scss` only for:

- global base rules
- font and dependency imports
- print rules
- Django template behavior that cannot reasonably be expressed with Tailwind at the call site

Do not add screen-specific classes to `main.scss`.

Use template-level SCSS only when the behavior is tied to that template component and cannot stay readable as Tailwind utilities.

## Tokens

Tokens are for semantic constants, not every measurement.

Good token candidates:

- color roles
- core radius scale
- shared motion duration
- repeated control heights
- repeated component geometry in a stable primitive

Bad token candidates:

- one screen's padding
- one modal's gap
- one list's thumbnail size
- values created because they might be useful later

If the value does not have a name a maintainer would naturally reuse, keep it as a Tailwind utility.

## Component Extraction

Do not extract because code looks similar.

Extract only when all are true:

- same user role
- same interaction behavior
- same state model
- same accessibility contract
- at least three real call sites
- the extracted API is simpler than the copied markup

If the prop list becomes a design language of its own, the extraction is too early.

## Size And Density

Do not solve mobile touch targets by making every visible control large.

Keep the visible control appropriate for the surface. Add hit area only when the control is visually compact but hard to tap.

Desktop management screens may be dense. Public reading and profile screens should keep more visual breathing room.

## CSS Growth Rules

Before adding CSS, answer:

- Can Tailwind express this clearly?
- Is this repeated in at least three places?
- Is this global behavior, not local styling?
- Will a maintainer know when to reuse it?

If any answer is no, do not add CSS.

`main.scss` growth is a smell. A UI-only fix should usually not touch it.

## Tests And Guardrails

Do not add tests that assert visual sizes, spacing, radius, or class names.

Heavy E2E tests should cover only P1 flows where a broken feature would seriously hurt the service.

Use static guardrails only for architectural mistakes that are cheap to detect, such as importing from the wrong package boundary. Do not turn taste into a test suite.

## Review Checklist

Before finishing a UI change:

- Is the diff small enough for the request?
- Did this preserve the best existing local pattern?
- Did this avoid new global CSS?
- Did this avoid new tokens unless they are clearly semantic?
- Did this avoid new tests for visual taste?
- Does mobile remain usable without making desktop oversized?
- Does dark mode use the same surface logic as light mode?

If the answer is no, reduce the change before asking for review.
