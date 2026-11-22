# Backend Compatibility

Refactoring must preserve externally visible behavior. Add tests for the affected behavior before moving code, and document intentional behavior changes separately.

## Compatibility requirements and tests

All test paths below are relative to `packages/server/test/`.

| Behavior to preserve | Test coverage |
| --- | --- |
| HTTP response envelopes, status codes, fields, and route behavior | `public-contract-regressions.test.ts`, `upgrade-regressions.test.ts` |
| Login, signup, OAuth, sessions, and two-factor authentication | `legacy-authentication.test.ts` |
| Post editing, drafts, publishing, and collection management | `authoring.test.ts`, `author-collections.test.ts`, `upgrade-data-regressions.test.ts` |
| Settings and administrator permissions | `personal-settings.test.ts`, `admin-settings.test.ts`, `application-screens.test.ts` |
| Public visibility, Markdown, sitemaps, and RSS | `public-discovery.test.ts`, `public-post.test.ts`, `public-pages.test.ts` |
| Public and private media, uploads, and deletion | `public-media.test.ts`, `content-media.test.ts`, `work-logs.test.ts` |
| `/v1` camelCase fields | `application-screens.test.ts` |
| Developer API token scopes, write operations, and snake_case wire format | `developer-api.test.ts`, `developer-api-contract.test.ts` |
| Existing database migration and schema constraints | `database-startup.test.ts`, `legacy-database.test.ts`, `upgrade-data-regressions.test.ts` |

## Persisted formats

These values are stored or already in use outside the application, so they keep their exact spelling: `pbkdf2_sha256$` password hashes, Fernet ciphertext and its key derivation, session and CSRF cookie names, the `X-CSRFToken` header, the `django_language` cookie, public URLs and their query parameters, and the notification `messageParams` keys `post_title` and `comment_id`, which feed the notification dedupe hash.

## Verification

Run focused tests while developing, then `pnpm test` and `pnpm type-check` before review. Commands and fixtures are described in the [Testing Guide](TESTING_GUIDE.md).

When changing public visibility or rendering, update `/llms.txt`, Markdown output for posts and series, sitemaps, and RSS together. Include hidden, draft, scheduled, and deleted content in the affected tests.

Schema changes must preserve valid rows and relationships. Test both an empty database and an upgraded copy using the [upgrade guide](UPGRADE_FROM_3.md).
