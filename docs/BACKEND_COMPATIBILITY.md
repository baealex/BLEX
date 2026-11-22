# Backend Compatibility

Refactors preserve observable behavior. Cover the affected contract before moving code, and describe intentional behavior changes separately.

## Contracts and coverage

All test paths below are relative to `packages/server/test/`.

| Contract | Coverage |
| --- | --- |
| HTTP response envelopes, status codes, fields, and route behavior | `public-contract-regressions.test.ts`, `upgrade-regressions.test.ts` |
| Login, signup, OAuth, sessions, and two-factor authentication | `legacy-authentication.test.ts` |
| Post editing, drafts, publishing, and collections | `authoring.test.ts`, `author-collections.test.ts`, `upgrade-data-regressions.test.ts` |
| Settings and administrator permissions | `personal-settings.test.ts`, `admin-settings.test.ts`, `legacy-screens.test.ts` |
| Public visibility, Markdown, sitemaps, and RSS | `public-discovery.test.ts`, `public-post.test.ts`, `public-pages.test.ts` |
| Public and private media, uploads, and deletion | `public-media.test.ts`, `content-media.test.ts`, `work-logs.test.ts` |
| Scoped Developer API tokens and mutations | `developer-api.test.ts` |
| Database adoption and schema constraints | `database-baseline.test.ts`, `upgrade-data-regressions.test.ts` |

## Verification

Run focused tests while developing, then `pnpm test` and `pnpm type-check` before review. Commands and fixtures are described in the [Testing Guide](TESTING_GUIDE.md).

When changing public visibility or rendering, update `/llms.txt`, post and series Markdown, sitemaps, and RSS together. Include hidden, draft, scheduled, and deleted content in the affected tests.

Schema changes must preserve valid rows and relationships. Test both an empty database and an upgraded copy using the [upgrade guide](UPGRADE_FROM_3.md).
