# UI Change Style Guide

Make the smallest change that improves the current screen. The [design guide](DESIGN_GUIDE.md) defines visual rules; this guide controls implementation scope. Do not rewrite that baseline during ordinary UI work.

## Implementation order

1. Read the current screen and reuse the best local pattern.
2. Prefer Tailwind utilities at the call site for layout and one-off tuning.
3. Use an existing shared component when its behavior and accessibility contract fit.
4. Extract a component only after at least three real call sites share the same role, behavior, state model, and accessibility needs. Its API must be simpler than the repeated markup.
5. Add tokens only when multiple independent surfaces need a stable semantic value.

Broad token changes, shared component rewrites, or global CSS need a concrete reason within the requested scope.

## Styles and tokens

- Keep screen-specific styles at the screen. Add scoped CSS only when utilities cannot express the behavior clearly.
- Keep global stylesheets for base rules, font and dependency imports, print rules, and genuinely shared behavior. A local UI fix should rarely change `packages/client/src/appearance/site.scss` or `packages/client/styles/main.scss`.
- Shared tokens describe color roles, core radius and motion scales, and stable primitive geometry. One modal's gap or one list's thumbnail size stays local.
- Do not extract components just because markup looks similar or add tokens for possible future use.

## Density and verification

- Keep controls visually appropriate for the surface; extend hit areas when compact controls are hard to tap. Management screens may be denser than reading pages.
- Check mobile, desktop, light theme, dark theme, keyboard access, and the affected interaction states.
- Test behavior changes. Do not add tests that assert spacing, radius, sizes, or class names. Reserve heavy E2E tests for critical flows.
- Use static guardrails for architectural boundaries, not visual taste.
- Review the diff for unrelated changes, new global CSS, premature abstractions, and unnecessary tokens before finishing.
