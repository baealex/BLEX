# Dependency Maintenance

Dependency manifests, the lockfile, and CI define the versions and checks in use. Check them directly rather than relying on a dated list of patched versions or past audit results.

## Dependency sources

| Scope | Sources |
| --- | --- |
| Workspace tools and package manager | `package.json` |
| Server, web, UI, and editor dependencies | Each package's `package.json` under `packages/` |
| Resolved dependency versions | `pnpm-lock.yaml` |
| Workspace overrides and local patches | `pnpm-workspace.yaml`, `patches/` |
| Node and pnpm versions used by images | `Dockerfile` |

Update manifests and the lockfile together. Keep pnpm aligned between the root manifest, Docker build, and CI. Preserve workspace overrides and patches during frozen installations.

## Braces parser patch

`patches/braces@3.0.3.patch` limits brace and parenthesis nesting to 100 groups before recursive compilation or expansion. pnpm applies it during installation. `packages/web/test/dependencySecurity.test.mjs` verifies it through the installed Lingui dependency chain.

Keep the patch until a replacement dependency provides equivalent protection. Verify ordinary globs, boundary cases, mixed groups, escaped input, and excessive nesting when changing it.

## Verification

Run from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm audit --prod --audit-level=high
pnpm audit
```

Run the server and web checks in [Testing Guide](TESTING_GUIDE.md), including entry size budgets when browser dependencies change.

[CI](../.github/workflows/CI.yml) audits production dependencies. The [release build](../.github/workflows/BUILD.yml) scans runtime and migration image candidates, and [Image Security](../.github/workflows/IMAGE_SECURITY.yml) scans published images on its configured schedule. The shared [image security action](../.github/actions/image-security/action.yml) defines report output and failure thresholds.

Audit output describes the dependency graph and advisory data at the time it runs. Record the actual results for each dependency change.
