# Backend Refactor Inventory

This document records backend controller smells that should be refactored in small, behavior-preserving PRs. It is an execution inventory, not a mandate for a big-bang rewrite.

## Scope and rules

- Keep one PR focused on one endpoint family or one cross-cutting policy.
- Add characterization tests before moving behavior that is not already tested.
- Prefer extracting policy, parsing, validation, and serialization into services before reshaping routing.
- Do not change public visibility, permission, or response contracts unless the PR explicitly calls out a bug fix.
- Keep views as request orchestration: auth gate, input source, service call, response mapping.
- Do not grow module-level helper functions in views. Move durable logic into explicit service/parser/serializer classes.

## Current highest-risk controllers

| Priority | File | Size | Main smell | Recommended first extraction |
| --- | --- | ---: | --- | --- |
| P1 | `backend/src/board/views/api/v1/setting.py` | ~520 lines | Mixed settings, notifications, heatmap, link meta, profile, password/account settings, pinned-post handling | Start with heatmap generation + cache policy only, then split each parameter group in separate PRs |
| P1 | `backend/src/board/views/api/v1/auth.py` | ~445 lines | Authentication, OAuth, captcha, 2FA, Telegram sync, username/account flows in one file | Extract explicit classes such as `AuthRequestParser`, `LoginRateLimitService`, `TwoFactorLoginService`, and `OAuthLoginService` |
| P1 | `backend/src/board/views/api/v1/series.py` | ~397 lines | Public listing, owner CRUD, ordering, valid-post lookup, serialization all inline | Extract series serializers and owner mutation service methods without changing visibility policy |
| P1 | `backend/src/board/views/api/v1/post.py` | ~320 lines | Comment serialization, post mutation, public/comment surfaces, query construction inline | Extract comment list serializer and public comment list policy |
| P2 | `backend/src/board/views/api/v1/utility.py` | ~301 lines | Staff-only cleanup/stat endpoints, destructive dry-run contracts, filesystem/media cleanup, permission duplication | Split cleanup orchestration and dry-run response contracts from view routing |
| P2 | `backend/src/board/views/api/v1/webhook.py` | ~223 lines | Channel CRUD, global channel, test dispatch, serialization in one controller | Extract webhook subscription serializer and channel mutation service |

## Cross-cutting smells to continue reducing

### Parameter and method mega-dispatch

Several views dispatch many unrelated behaviors through one `parameter`, URL, or method branch. Do not split URL routing first. First extract per-parameter service methods and serializers, then consider route reshaping only after characterization tests.

Candidate surfaces:

- `setting(request, parameter)`: settings account, notification, heatmap, social link, posts, pinned-post management.
- `user_series(...)`: public GET, owner create/update/delete, valid-post lookup, ordering.
- `post.py`: post creation/update and comment-list serialization.

### Permission checks

Several controllers still do direct permission branching and `StatusError` construction inline. Prefer adding focused service helpers similar to `ApiPermissionService` or domain-specific policy services.

Candidate surfaces:

- `setting.py`: account/settings/profile/link meta/pinned-post user ownership rules.
- `auth.py`: authenticated account mutation and OAuth/2FA gates.
- `post.py`: author-only mutation and public comment list boundaries.
- `webhook.py`: user/global channel scope and staff-only global mutations.

### Request body parsing

JSON parsing is now explicit in migrated endpoint families. Remaining parser cleanup should avoid broad mechanical rewrites unless tests cover legacy behavior.

Current policy:

- Strict mutation: `ApiRequestBodyService.parse_json_or_error()`.
- Legacy partial update that intentionally treats invalid JSON as empty: `parse_json_or_empty_for_legacy_only()`.
- Form-compatible legacy endpoints: `parse_json_or_querydict()`.

Before changing parser behavior, record whether invalid JSON should be strict error or legacy empty for that endpoint.

Remaining non-migrated parser candidates from the older plan:

- `developer_token.py`
- `auth.py`
- `form.py`
- `markdown.py`
- `draft.py`

### Serialization in views

Inline dictionaries and nested `map(lambda ...)` patterns make contracts hard to test independently.

Extraction candidates:

- `post.py`: comment/reply response shape.
- `series.py`: public series detail/list response shape.
- `setting.py`: notifications, heatmap, user link meta, account settings response shape.
- `webhook.py`: subscription/global channel response shape.

When extracting serializers, preserve existing `select_related`, `prefetch_related`, and `annotate` behavior. Public visibility serializers must keep using `PublicPostService` and `PublicSeriesService` contracts.

### Destructive/admin cleanup endpoints

Cleanup and utility endpoints should keep dry-run defaults, staff guards, filesystem/media boundaries, and response shapes fixed by characterization tests before extraction.

Candidate surfaces:

- `utility.py`: cleanup/stat actions.
- Any future media/file cleanup or bulk destructive endpoint.

## Recommended PR sequence

1. `setting.py` heatmap extraction only: preserve cache key, TTL, and 365-day date window.
2. `setting.py` notify/notify-config extraction only: keep role-specific notification config visibility unchanged.
3. `setting.py` social link meta parsing characterization, then extraction.
4. `auth.py` login parser + invalid body characterization using an explicit parser class.
5. `auth.py` 2FA login/rate-limit orchestration extraction into service classes.
6. `series.py` serializer extraction without changing visibility policy.
7. `post.py` comment-list policy/serializer extraction; keep comment creation policy from PR #380 intact.
8. `webhook.py` serializer extraction and global/user channel policy naming.
9. `utility.py` destructive cleanup orchestration/dry-run contract extraction.

## Test strategy

- For pure extraction, run the endpoint family tests plus service tests for any touched service.
- For public visibility surfaces, also run sitemap/RSS/agent-readable tests when the response can affect discovery.
- For auth/account flows, add characterization tests before extracting because response contracts may be client-sensitive.
- For serializer extraction on list/detail endpoints, check query construction and guard against N+1 regressions when practical.
- For destructive cleanup endpoints, test dry-run behavior, staff guard, and unchanged response shape before moving orchestration.
