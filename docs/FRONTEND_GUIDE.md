# BLEX Frontend Philosophy

> "Perfection is achieved, not when there is nothing more to add, but when there is nothing left to take away." — Antoine de Saint-Exupéry

## 1. The Core Principle

The frontend is a **constellation of islands**—not a monolith. Each island is self-contained, lazy-loaded, and composable.

We prioritize **Composability** and **Performance** over complexity. Our code should load fast, render predictably, and scale elegantly.

---

## 2. Architecture: Islands with Clear Boundaries

We organize our frontend as a **monorepo** with strict separation of concerns. Do not blur them.

### The Package Structure Rule

- **`/backend/islands/packages/ui`**: Shared UI primitives. Reusable across any project.
  - *Belongs here*: Button, Input, Card, Dialog, Select—atomic components.
  - *Doesn't belong*: Page-specific logic, API calls, business logic.
  - *Dependencies*: Radix UI for accessible primitives. Don't reinvent accessibility.

- **`/backend/islands/packages/editor`**: The Tiptap editor. Isolated complexity.
  - *Why isolated*: The editor is a core feature. Complexity must not leak.

- **`/backend/islands/apps/remotes`**: Islands App. React meets Django.
  - *What it does*: Web Components wrapper (`<island-component>`), lazy loading, query caching.

> **"If a component could be used on a different project, it belongs in `/packages/ui`. If it's BLEX-specific, it lives in `/apps/remotes`."**

---

## 3. TypeScript: The Contract is Sacred

TypeScript is not optional. It's the **contract** between you and the future.

- **Props**: Always define interfaces. Use union types for variants (`'primary' | 'secondary'`).
- **API Responses**: Type everything. Use `Response<T>` wrappers.
- **Strict Mode**: Non-negotiable. No `any` unless absolutely necessary—leave a comment explaining why.

> **"If you're using `any`, you're lying to the compiler."**

---

## 4. React Patterns: The Non-Negotiables

### React Query for Server State

Do not manage server state with `useState`. Use **React Query**.

```tsx
// ✅ Good
const { data } = useQuery({ queryKey: ['posts'], queryFn: fetchPosts });

// ❌ Bad
useEffect(() => { fetchPosts().then(setPosts); }, []);
```

### Component Composition Over Props

Build components that **compose**, not components that configure.

```tsx
// ✅ Good: Compose
<Dialog>
  <DialogTrigger>Open</DialogTrigger>
  <DialogContent>...</DialogContent>
</Dialog>

// ❌ Bad: Configure
<Dialog trigger="Open" content="..." />
```

### Lazy Load Islands, Not Everything

**Only lazy load page-level island components**. Use `React.lazy()` for islands that aren't on the critical rendering path.

**Don't lazy load**:
- Components needed for initial render (above the fold)
- Small components (overhead > benefit)
- Critical user interactions

> **"The fastest code is the code that never loads. But don't create waterfalls."**

---

## 5. Component Design Principles

### The Single Responsibility Rule

A component should do **one thing well**. If you're writing a component that fetches, edits, and deletes, you're doing it wrong.

### Props Should Be Predictable

- **Variants**: Use union types. `variant: 'primary' | 'secondary'`, not `variant: string`.
- **Children**: Prefer `children` over `content` or `text` props for flexibility.

### Style with Tailwind

- Use Tailwind classes for all styling.
- Follow design tokens from `DESIGN_GUIDE.md`: `rounded-lg`, `duration-150`, `ring-1 ring-gray-900/5`.
- Only use SCSS when Tailwind isn't enough (animations, pseudo-elements).

---

## 6. State Management: The Hierarchy

1. **Server State**: React Query (API data, remote state)
2. **URL State**: Search params, route params (for shareable state)
3. **Local State**: `useState`, `useReducer` (UI toggles, form inputs)
4. **Global State**: Context API (sparingly—theme, auth, modals only)

> **"If you're prop drilling through 4+ levels, use Context or rethink your composition."**

---

## 7. Forms and Validation

- **React Hook Form** for form state management.
- **Zod** for schema validation.
- **`@hookform/resolvers`** to connect them.

```tsx
const schema = z.object({ username: z.string().min(3) });
const { register, handleSubmit } = useForm({ resolver: zodResolver(schema) });
```

---

## 8. API Integration

- **Axios** with CSRF token auto-attached.
- **Typed Responses**: `Response<T> = DoneResponse<T> | ErrorResponse`.
- **Error Handling**: Check `response.status` before accessing `response.body`.

---

## 9. Performance Rules

### React 19 Compiler Handles Optimization

We use **React 19 with the React Compiler**. It automatically handles memoization.

- **Don't manually add** `useMemo`, `useCallback`, or `memo` unless you have a specific, measured performance issue.
- **The compiler optimizes** re-renders automatically. Trust it.
- **Only override** when profiling proves it's necessary.

### Code Splitting

- Use `React.lazy()` for **islands only** (not critical path components).
- Manual bundle chunks for vendors (React, Tiptap, Zod) are already configured.

### Images

- `loading="lazy"` for images below the fold.

> **"Premature optimization is the root of all evil. Let the compiler do its job."**

---

## 10. Checklist for Frontend Work

Before marking a task as "Done":

1. **Is it typed?** No `any` types unless absolutely necessary.
2. **Is it composable?** Can this component be reused?
3. **Is it performant?** Did you lazy load?
4. **Does it follow the design guide?** Check `DESIGN_GUIDE.md`.
5. **Does it pass linting and type checks?**
   ```bash
   npm run islands:lint
   npm run islands:type-check
   ```

---

## 11. Development Workflow

```bash
npm i        # Install dependencies (backend + frontend)
npm run dev  # Start all dev servers in parallel
```

> **Note**: Lint and type checks are **only** for Islands (React) work, **not** for Django template work.
