# BLEX Backend Philosophy

> "Code is read much more often than it is written." — Guido van Rossum

## 1. The Core Principle

The backend is the **silent foundation**. It doesn't need to be flashy; it needs to be **unshakable**.

We prioritize **Readability** and **Stability** over clever one-liners. Our code should be boringly predictable.

---

## 2. Architecture: Service First

We follow a strict separation of concerns. Do not mix them.

### The "Service Layer" Rule
Views should be dumb. Models should be structural. Logic belongs in **Services**.

-   **Views (`views/`)**: The Gatekeepers. They handle HTTP requests, permissions, and input validation. They *delegate* work to services.
    -   *Bad*: Writing business logic (e.g., calculating points, sending emails) inside a View.
    -   *Good*: `UserService.create_user(...)`
-   **Services (`services/`)**: The Workers. They contain the actual business logic. They are reusable and testable.
-   **Models (`models.py`)**: The Data Structure. Keep them lean. Only add methods that directly relate to the data itself (e.g., `__str__`, simple properties).

> **"If you are writing an `if` statement in a View, ask yourself: Should this be in a Service?"**

---

## 3. Testing: The Non-Negotiable

Tests are not a "nice to have". They are **mandatory**.

### The "Sleep Well" Standard
We write tests so we can deploy on Friday and sleep soundly.

-   **Coverage**: Every new feature MUST have a corresponding test.
-   **Scenarios**: Test the "Happy Path" (it works), but obsess over the "Edge Cases" (it fails safely).
-   **Mocking**: Don't hit real APIs in tests. Mock them.

> **Command**: `npm run server:test`

---

## 4. Code Quality

### Type Hints are Documentation
Python is dynamic, but our codebase shouldn't be a guessing game. Use Type Hints (`str`, `int`, `List[User]`) for all function arguments and return values.

### Naming is Logic
-   **Explicit > Implicit**: `get_active_user_by_email()` is better than `get_user()`.
-   **English Only**: Code, comments, and commit messages must be in English.

### Anti-Patterns to Avoid

#### 1. Inline Imports
**Never** import modules inside functions. All imports must be at the top of the file.

```python
# BAD - Import inside function
def set_tags(self, tags: str):
    from board.services.tag_service import TagService  # Don't do this!
    TagService.set_post_tags(self, tags)

# GOOD - Import at top of file
from board.services.tag_service import TagService

def set_tags(self, tags: str):
    TagService.set_post_tags(self, tags)
```

For circular import issues, use `TYPE_CHECKING`:
```python
from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from board.models import Post
```

#### 2. Redundant Comments
Don't write comments that repeat what the code does. Code should be self-explanatory.

```python
# BAD
query_dict = request.GET.copy()  # Get the current query parameters
query_dict['page'] = page_number  # Update the page parameter

# GOOD
query_dict = request.GET.copy()
query_dict['page'] = page_number
```

#### 3. Underscore Private Functions
Avoid creating `_private_functions` at module level. Use classes to group related functionality.

```python
# BAD
def _parse_tags(tags: str) -> set:
    ...

def _get_or_create_tags(tag_values: set) -> dict:
    ...

# GOOD
class TagService:
    @staticmethod
    def parse_tags(tags: str) -> Set[str]:
        ...

    @staticmethod
    def get_or_create_tags(tag_values: Set[str]) -> Dict[str, Tag]:
        ...
```

---

## 5. Checklist for Backend Work

Before marking a task as "Done":

1.  **Is logic in a Service?** The View should look empty.
2.  **Are there tests?** Do they pass?
3.  **Are types defined?** No generic `Any` unless absolutely necessary.
4.  **Is it efficient?** Watch out for N+1 queries.

---

## 6. Development Workflow

To start development locally, environment setup is simple using `npm`:

```bash
npm i       # Installs dependencies
npm run dev # Starts the dev server
```
