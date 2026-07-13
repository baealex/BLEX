# Backend Compatibility Contract

Backend refactors must preserve observable behavior unless a separately approved change explicitly
introduces a new contract. A refactor PR must add or update a characteristic test before moving code.

## Protected surface

| Contract | Authoritative coverage |
| --- | --- |
| Page, legacy v1, and developer API routes, names, callbacks, and matching priority | `board.tests.test_backend_compatibility_contract.URLCompatibilityContractTests` |
| Legacy v1 HTTP 200 response envelope, error codes, messages, and camelCase serialization | `board.tests.test_backend_compatibility_contract.LegacyResponseCompatibilityContractTests` and `board.tests.api` |
| Authentication, signup, OAuth, settings, and 2FA session behavior | `board.tests.api.test_auth`, `test_setting`, `test_two_factor_auth`, and `board.tests.templates.test_oauth_callback` |
| Post, draft, publish, related-post, like, and pinned-post behavior | `board.tests.api.test_post`, `test_draft`, `test_pinned_post`, `board.tests.templates.test_post_detail`, and `TemplateLikeCompatibilityContractTests` |
| Public visibility across `/llms.txt`, Markdown, sitemap, `/posts/sitemap.xml`, and RSS | `board.tests.test_agent_content`, `board.tests.templates.test_agent_discovery`, and `board.tests.services.test_public_post_service` |
| `board.models` imports, Django model identity, and database table names | `board.tests.test_backend_compatibility_contract.PythonImportCompatibilityContractTests` |
| `board.views.api.v1` endpoint re-exports | `board.tests.test_backend_compatibility_contract.PythonImportCompatibilityContractTests` |
| `PostService` facade method parameter names, order, and defaults | `board.tests.test_backend_compatibility_contract.PythonImportCompatibilityContractTests` |
| Post image deduplication, replacement, deletion, and shared-file behavior | `board.tests.services.test_image_dedup` |
| Valid migration history and model state | Full backend suite plus `npm run server:check-migrations` |

## Refactor verification

Run the smallest relevant test module while developing, then run both commands before opening or
merging a backend refactor PR:

```bash
npm run server:test
npm run server:check-migrations
```

Database constraint migrations must also test their data migration against duplicates. Cleanup may
merge only invalid duplicates deterministically and must retain all valid rows and relationships.

When public post visibility or rendering changes, update `/llms.txt`, post and series Markdown,
sitemaps, and RSS behavior and tests together as required by `AGENTS.md`.

## Compatibility-first rule

Do not use a structural refactor to correct an existing API status code, response field, error
message, filter default, ordering rule, URL, import, or session transition. Preserve it through a
facade or re-export and propose any intentional behavior change separately.
