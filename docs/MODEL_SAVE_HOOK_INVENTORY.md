# Model Save Hook Inventory

This document records model-layer side effects that should be reduced in small, behavior-preserving PRs. It is an inventory for future refactoring, not a request to rewrite `models.py` in one pass.

## Scope and rules

- Keep each PR focused on one model or one side-effect category.
- Add characterization tests before moving any `save()` hook or method that writes related rows, touches files, or calls external services.
- Preserve current public behavior first; only fix bugs in PRs that explicitly call out the behavior change.
- Prefer service classes for orchestration, filesystem work, notifications, encryption policy, and cross-model writes.
- Keep model methods limited to structural behavior, simple predicates, simple URL helpers, and data-local formatting.

## Current save hooks and side effects

| Priority | Model / method | Current behavior | Main smell | Safe first action |
| --- | --- | --- | --- | --- |
| P2 | `Post.save()` | Detects changed title image and generates preview/minify/original thumbnails after saving. Honors `_skip_thumbnail`. | Filesystem image work hidden behind any post save; expensive side effects are easy to trigger from unrelated updates. | Add explicit tests for new image, changed image, unchanged image, and `_skip_thumbnail`, then extract thumbnail decision/execution into a post image service. |
| P2 | `PostContent.save()` | Recalculates `post.read_time` and calls `post.save()` before saving content. | Cross-model write from content model; content save can trigger `Post.save()` side effects unless the post object is clean enough; parent write can survive if content save later fails. | Characterize read-time update and ensure no unexpected thumbnail generation, then move read-time synchronization into a transaction-aware post content service/write path. |
| P2 | `Profile.save()` | Detects changed avatar and generates thumbnail after saving. | Filesystem image work hidden behind profile saves; expensive for unrelated profile updates. | Add tests for new avatar, changed avatar, and unchanged avatar, then extract avatar thumbnail behavior into a profile image service. |
| P3 | `Series.save()` | Generates URL when empty and refreshes `updated_date` on every save. Compatibility delegate now routes slug/timestamp policy through `SeriesSaveService`. | Save hook remains for backward compatibility; bulk updates still bypass model save as before. | Keep characterization coverage around URL generation/collision and timestamp refresh; avoid adding new slug policy outside `SeriesSaveService`. |
| P3 | `TelegramSync.save()` | Encrypts `tid` when non-empty and not already encrypted. Compatibility delegate now routes encryption/idempotence through `TelegramSyncEncryptionService`. | Save hook remains for backward compatibility; broad malformed-value behavior is preserved by characterization tests. | Keep encryption/idempotence policy in `TelegramSyncEncryptionService`; avoid adding new encryption logic to model/view code. |
| P3 | `SiteSetting.save()` | Forces `pk = 1` before every save to maintain singleton behavior. | Singleton policy is hidden in save and can surprise callers trying to create test rows. | Characterize singleton behavior and `get_instance()`; keep hook unless replacing with a manager/service and migration-safe admin path. |

## Related model-layer write methods

These are not `save()` overrides, but they perform writes or side effects from model methods and should be reviewed with the same caution.

| Priority | Model / method | Current behavior | Main smell | Safe first action |
| --- | --- | --- | --- | --- |
| P2 | `Config.create_or_update_meta()` | Creates or updates `UserConfigMeta` rows. | Cross-row mutation lives on a model and duplicates service-layer settings policy. | Characterize type conversion and unchanged-value behavior, then move to a user config service. |
| P2 | `Notify.send_notify()` | Reads Telegram sync data and dispatches a Telegram message through `SubTaskProcessor`. | External notification side effect lives on model; service/network imports are coupled to `models.py`. | Characterize no-telegram and telegram paths with mocks, then move dispatch to notification service. |
| P3 | `WebhookSubscription.record_success()` / `record_failure()` | Updates failure counters, last success date, and auto-deactivates after `MAX_FAILURES`. | Domain state transition is model-local but writes immediately; acceptable short term, but webhook service already orchestrates channels. | Add service-level tests around success/failure transitions, including that success does not reactivate inactive channels, before moving to webhook service if needed. |

## Adjacent model smells to avoid expanding

- `Comment.clean()` imports `ValidationError` inside the method even though `ValidationError` is already imported at module level.
- `Post.is_published()` and `Post.is_draft()` import `PostStatusService` inside model methods. This avoided a circular dependency, but it is still a model-to-service dependency. Prefer calling `PostStatusService` from services/views and eventually make these model helpers thin compatibility wrappers or remove them after usage is migrated.
- `Post.create_unique_url()` and `Series.create_unique_url()` mutate URL fields after database collision checks. URL behavior is a public permalink contract, so characterize collision behavior before changing it.
- Query-heavy presentation helpers such as `Tag.get_image()`, `Series.thumbnail()`, `Profile.collect_social()`, and `Profile.total_channels()` can become N+1 risks when called from list serializers or templates. Treat these as residual risks during serializer extraction.
- Broad `except:` blocks exist in image URL and encryption helper code. Refactors should narrow exceptions only when tests prove the expected fallback behavior.

## Recommended PR sequence

1. `Post.save()` thumbnail characterization only: mock `make_thumbnail` and lock new-image, changed-image, unchanged-image, and `_skip_thumbnail` behavior.
2. Extract post thumbnail decision/execution to a service while keeping `Post.save()` as a compatibility delegate.
3. `PostContent.save()` read-time characterization: verify content save updates `post.read_time` and does not unexpectedly perform image work.
4. Move read-time synchronization to post content write service paths, then decide whether the model hook can be reduced safely.
5. `Profile.save()` avatar thumbnail characterization and service extraction.
6. `Notify.send_notify()` delivery characterization and extraction to a notification delivery service.
7. `Config.create_or_update_meta()` characterization and extraction to a user config service.
8. `WebhookSubscription` success/failure transition characterization before optional service extraction.
9. `Series.save()` slug/timestamp characterization and service extraction completed; keep compatibility delegate covered by tests.
10. `TelegramSync.save()` encryption idempotence characterization and service extraction completed; keep compatibility delegate covered by tests.
11. `SiteSetting.save()` singleton characterization; keep the hook unless a safer manager/service replacement is proven.

## Test strategy

- Use mocks for filesystem and external notification behavior.
- Prefer focused model/service tests over API tests for save-hook characterization.
- For hooks that can trigger other hooks, assert the absence of unintended calls where possible.
- Run the smallest focused test module for each PR, then `npm run server:test` when moving shared persistence behavior.
