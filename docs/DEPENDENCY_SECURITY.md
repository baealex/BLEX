# Dependency Security Patches

The November 2026 dependency review covers the pinned Python runtime, root npm
development tools, and the complete Islands pnpm dependency graph. It builds on
the October 2026 patch set.

## Patched versions

| Dependency | Version | Scope |
| --- | --- | --- |
| certifi | 2026.10.19 | Python TLS trust store |
| Pillow | 13.0.0 | Python image processing |
| soupsieve | 4.0.1 | Python runtime |
| urllib3 | 2.8.0 | Python runtime |
| axios | 1.20.0 | Browser runtime |
| follow-redirects | 1.16.3 | Axios Node adapter dependency |
| Vite | 8.3.5 | Development server and build tools |
| seroval | 1.8.1 | Router dependency |
| brace-expansion | 5.0.12 | Development tools |
| minimatch | 11.0.8 | Lint and build tools |
| glob | 14.0.6 | Build scripts |
| source-map-js | 1.2.2 | Build tools |
| tinypool | 2.1.2 | Translation tools |
| concurrently | 10.0.6 | Local development runner |
| shell-quote | 1.12.0 | Development runner dependency |

Direct dependencies use patched version requirements. Transitive dependencies
are updated in the lockfile within their upstream version ranges. The existing
minimatch override moves from 10.2.5 to 11.0.8 because no 10.x release fixes
[GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249); the
lint toolchain runs on the forced major version. Every resolved version passes
the workspace `minimumReleaseAge` policy without a new exclusion, which is why
minimatch stays on 11.0.8 instead of the newer 11.0.9. CI uses the same pnpm
11.17.0 version as the workspace and Docker build.

## Braces nesting protection

[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
reported unbounded nesting in braces 3.0.3, which has no fixed release. The
advisory was withdrawn on 2026-10-23, so audits no longer report it. This
package is used by build and translation tools; it is not a production runtime
dependency.

`packages/web/patches/braces@3.0.3.patch` limits the parser to 100 nested
groups, following the mitigation proposed in
[the upstream report](https://github.com/micromatch/braces/issues/70).
Both braces and parentheses count toward the limit. Excessive nesting raises a
`SyntaxError` before a recursive compiler or expander processes the tree.
Escaped characters, quoted strings, and character classes remain literal.
The mitigation covers string patterns parsed by the library; it does not
validate an AST constructed outside the parser.

pnpm applies the patch during installation. Docker copies the patch before its
frozen installation. `dependencySecurity.test.mjs` tests the installed package
through the translation tool's dependency chain, including the limit boundary,
the 4,000-level attack pattern, and ordinary glob behavior.

The local patch stays in place as a defensive limit while the published
package remains 3.0.3. Replace it with an upstream release that bounds nesting
when one is available.

## Entry size budgets

Axios 1.20.0 increases each affected feature's initial JavaScript by approximately
5.1 KiB raw / 1.7 KiB gzip. The affected feature budgets account for this measured
security update. Base-page and shared runtime budgets keep their existing limits.

## Verification

Run from the repository root after installing dependencies:

```sh
pnpm audit
ppnpm test
pnpm lint
pnpm type-check
ppnpm test:web
pnpm i18n:check
pnpm build:web
pnpm check:entry-budgets
```

Run from `packages/web`:

```sh
ppnpm install --frozen-lockfile
ppnpm audit --prod
ppnpm audit
```

The expected audit results for this patch set are no known Python, root npm, or
pnpm vulnerabilities, including the full pnpm report. These results describe
dependency advisories and are not a complete application security assessment.
