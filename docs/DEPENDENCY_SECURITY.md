# Dependency Security Patches

The October 2026 dependency review covers the pinned Python runtime, root npm
development tools, and the complete Islands pnpm dependency graph.

## Patched versions

| Dependency | Version | Scope |
| --- | --- | --- |
| certifi | 2026.10.19 | Python TLS trust store |
| Pillow | 13.0.0 | Python image processing |
| soupsieve | 2.9 | Python runtime |
| urllib3 | 2.8.0 | Python runtime |
| axios | 1.20.0 | Browser runtime |
| follow-redirects | 1.16.1 | Axios Node adapter dependency |
| Vite | 8.3.5 | Development server and build tools |
| seroval | 1.6.3 | Router dependency |
| brace-expansion | 5.0.12 | Development tools |
| source-map-js | 1.2.2 | Build tools |
| tinypool | 2.1.2 | Translation tools |
| concurrently | 10.0.6 | Local development runner |
| shell-quote | 1.12.0 | Development runner dependency |

Direct dependencies use patched version requirements. Transitive dependencies
are updated in the lockfile within their upstream version ranges. No new version
overrides are needed for this patch set; the old brace-expansion override is also
removed because minimatch already accepts the fixed release. CI uses the same
pnpm 11.17.0 version as the workspace and Docker build.

## October 22 review

The full dependency audit found 25 Python advisories in certifi and Pillow,
plus seven unmitigated pnpm advisories in follow-redirects and Vite. Updating
these four packages removes those findings. The existing braces advisory below
remains visible with its local mitigation.

Certifi 2026.10.19 removes the compromised emSign trust root while retaining
unaffected roots. Pillow 13.0.0 supplies the image parser and encoder fixes;
its supported Python versions include the project's Python 3.12 runtime.
See the [certifi advisory](https://github.com/certifi/python-certifi/security/advisories/GHSA-6q48-6c7w-9gw2)
and [Pillow release notes](https://pillow.readthedocs.io/en/stable/releasenotes/13.0.0.html).

Vite now requires at least 8.3.5, also selected by the lockfile within
the existing major version. This removes five development-server advisories,
including the bundled launch-editor command-injection fixes.

Follow-redirects updates normally within Axios's existing `^1.16.0` range;
no direct dependency or override is added. Its two credential-stripping fixes
are covered by local HTTP redirect tests through the installed Axios dependency
chain. The tests check array-form authorization, proxy authorization and cookie
headers, custom sensitive headers containing `^` and `|`, and preservation of
ordinary headers. Both tests fail with 1.16.0 and pass with 1.16.1.

Prefer normal dependency and lockfile updates. Use an override only when
upstream version constraints prevent selecting a fixed release. Do not suppress
an advisory solely to obtain a clean audit report.

## Braces nesting protection

[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
affects braces 3.0.3. The maintainer has not published a fixed version. This
package is used by build and translation tools; it is not a production runtime
dependency.

`backend/islands/patches/braces@3.0.3.patch` limits the parser to 100 nested
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

Full `pnpm audit` still reports this advisory because the published package
version remains 3.0.3. This finding is retained rather than suppressed.
Replace the local patch with an upstream fixed release when one is available.

## Entry size budgets

Axios 1.20.0 increases each affected feature's initial JavaScript by approximately
5.1 KiB raw / 1.7 KiB gzip. The affected feature budgets account for this measured
security update. Base-page and shared runtime budgets keep their existing limits.

## Verification

Run from the repository root after installing dependencies:

```sh
npm audit
npm run server:test
npm run islands:lint
npm run islands:type-check
npm run islands:test
npm run islands:i18n:check
npm run islands:build
npm run islands:check-entry-budgets
```

Run from `backend/islands`:

```sh
pnpm install --frozen-lockfile
pnpm audit --prod
pnpm audit
```

Audit the installed Python environment with `pip-audit`. The expected audit
results for this patch set are no known Python, root npm, or production pnpm
vulnerabilities, with the locally mitigated braces advisory in the full pnpm
report. These results describe dependency advisories and are not a complete
application security assessment.
