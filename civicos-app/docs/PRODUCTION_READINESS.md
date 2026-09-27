# Production readiness and safe integration

Audit date: 2026-09-27. Working branch: **databaseUpdate**. Target: **main**.
Canonical origin: **https://www.civicos.work**. Local: **http://localhost:5173**.

## Gemini follow-up (2026-09-27)

The owner confirmed key rotation/revocation and Vercel environment cleanup.
The owner also confirmed the published Gemini firewall rule (10 POSTs/IP per
60 seconds, enforced with 429). Gemini implementation and local validation are
complete; no further Gemini setup checkpoint blocks branch integration.
A shared Gemini handler and Vercel `/api/gemini/[task].js` endpoint are now
implemented on databaseUpdate; see [GEMINI.md](GEMINI.md) for current deployment
checks and test evidence. No production deployment was performed. The older
Gemini hosting/key-remediation findings below describe the earlier audit;
voice/feed hosting limitations still apply. AI components remain unmounted as
requested: this follow-up is API-only. Auth0/Supabase were not changed.

## Release decision

The 29 catalog forms are ready for a **test-data-only hackathon persistence
release**, subject to the manual security/configuration checkpoint below and
post-deployment smoke tests. The owner has confirmed real Auth0/Supabase submission,
refresh, logout and login restoration. This is not a government submission service
or a release approved for real sensitive citizen data.

The whole site's external integrations are **not fully production-ready**:
Vercel currently returns 404 for `/api/tts/status`, `/api/gemini/status`, and
`/api/feeds/news?province=ON`. Repository handlers are Vite dev/preview middleware;
there are no deployed function adapters or repository Vercel configuration.
The existing browser voice / unavailable-feed / AI fallback behavior is retained.
If live feeds, ElevenLabs or Gemini are a release requirement, hold deployment
until their server routes and (for paid APIs) authentication, rate limits and
budget controls have a separately reviewed rollout. Adding environment variables
alone cannot deploy those handlers. No paid public proxy was enabled by this audit.
The Gemini components are present in main but currently not mounted by App/the
hub/wizard; this audit preserves them and does not redesign or reconnect those UIs.

## Branch inspection and preservation

Fetched `origin` successfully. At audit time:

- Persistence parent: `0ce9366` (`Add Supabase application persistence`).
- Latest `origin/main`: `314acba` (team UI merge).
- The already-resolved pending merge had that exact main commit as `MERGE_HEAD`.
  No newer main commits or unresolved index entries were found.
- The integration is completed only on `databaseUpdate`; main is not checked out,
  merged into, pushed, or deployed by this work.
- The unrelated root `package-lock.json` name change remains unstaged and excluded.

Fourteen paths changed on both sides since their common ancestor:

```text
civicos-app/.env.example
civicos-app/package.json
civicos-app/package-lock.json
civicos-app/src/App.tsx
civicos-app/src/components/wizard/DynamicModalWizard.jsx
civicos-app/src/components/wizard/ReviewSummary.jsx
civicos-app/src/data/fieldBuilders.js
civicos-app/src/data/servicesData.js
civicos-app/src/features/dashboard/CitizenDashboard.tsx
civicos-app/src/features/dashboard/RequestDetailsDialog.tsx
civicos-app/src/features/dashboard/RequestTracker.tsx
civicos-app/src/lib/reviewPacket.js
civicos-app/src/state/CivicDataContext.tsx
civicos-app/src/types/dashboard.ts
```

Nine previously conflicted paths were resolved: package/lockfile, wizard,
ReviewSummary, CitizenDashboard, RequestDetailsDialog, RequestTracker,
reviewPacket, and CivicDataContext. No whole-side ours/theirs resolution was used
for source code. Dependencies include both Gemini and Supabase. The obsolete
CitizenDashboard stays removed per main; the new CitizenHub routes persisted
withdrawal through saved details. New layout, sidebar, search, translations,
alerts and module pages remain. The capitalization-only duplicate I18nContext
was removed, with compatibility consumers sharing the active language provider;
AI card props were reconciled without removing teammate components.

## Changes in this audit

- `src/services/applicationRepository.ts`: read four individual public variables;
  never capture the full Vite environment object.
- `vite.config.js`: disable automatic environment-prefix exposure; explicitly
  define only the four public identifiers. Other Vite built-ins still work.
- `server/geminiProxy.js`: clarify the ignored-key warning for the hardened build.
- `tests/production-build.test.mjs`: build-level secret-exclusion regression,
  including accidentally prefixed private values and near-matching names.
- `tests/browser/production.spec.mjs`: isolated production builds at both origins;
  module/hash refresh, language/search UI and Auth0 PKCE login/logout redirect checks. No real
  production, Auth0, Supabase or paid API requests are sent by these tests.
- `package.json`: `test:production` command.
- `.env.example`, `docs/AUTH0.md`, `docs/PERSISTENCE.md`: remove stale statements
  that the client is not wired up or live persistence remains untested.
- This document: evidence, boundaries, module migration recommendation and release
  instructions. Existing tests, SQL migrations and teammate features are retained.

## Security findings and checkpoint

**A private Gemini key was present in the old local `dist` bundle.** Although
`server/geminiProxy.js` ignores `VITE_GEMINI_API_KEY`, passing the entire
`import.meta.env` object in the repository adapter included it in compiled JS.
This was not harmless unused configuration. The new build explicitly exposes
only public variables. Both local private API key values were absent from rebuilt
assets; sentinel-key regression checks also pass. No key values are printed in
reports or committed.

The checked public production entry/vendor/helper assets did not match the local
private keys. This is a limited observation, not proof that no older deployment,
preview, downloaded artifact or different key was ever exposed. Pattern checks
of tracked files and relevant Git history found no private-key/Google-key/
Supabase-secret patterns; local environment and SQL bundles remain ignored.

**Before releasing, perform this manual checkpoint and confirm completion:**

1. In Google AI Studio → API keys (or Google Cloud Console → APIs & Services →
   Credentials for the same project), identify the key currently stored locally
   under `VITE_GEMINI_API_KEY`. Create a replacement in that project and revoke
   the old key. Do not paste either key into chat, Git, screenshots or logs.
2. In ignored `civicos-app/.env.local`, remove `VITE_GEMINI_API_KEY`. If local Gemini
   is needed, store the replacement as **`GEMINI_API_KEY`** only. Restart Vite.
   The old variable never enabled Gemini's proxy. Do not rename a compromised
   value and continue using it without rotation.
3. In Vercel → CivicOS → Settings → Environment Variables, remove
   `VITE_GEMINI_API_KEY` if present in any scope. No Gemini key is needed for the
   current static deployment. Store a replacement only in a future server's
   runtime scope when the server rollout is ready. Merely changing an environment
   setting does not remove previously deployed bundles; rotate the key first.
4. Review previously shared/published build artifacts and previews for the old
   key; retire affected deployments if any. The local `dist` has been rebuilt.
5. Verify Vercel's production branch/root/build settings against the table below.
   The repository cannot independently prove dashboard-only settings.

This audit does not rotate keys or edit dashboards. No new SQL is needed. **Do
not rerun either successfully applied Supabase setup bundle.**

Other boundaries:

- Auth0 uses SDK-managed localStorage and refresh tokens. That supports reloads
  but means XSS could steal browser tokens. No custom token cache or Client Secret
  was introduced. Avoid untrusted scripts and real sensitive test inputs.
- Housing/Doctor/Autism data remains in browser storage after logout, although
  the private account view is cleared. Account-keyed storage is not encryption
  or database authorization; use synthetic information only.
- Owners can trigger their own explicitly labelled prototype review lifecycle.
  These are not privileged government/caseworker decisions.
- `npm audit --omit=dev` reported zero known runtime dependency vulnerabilities at
  audit time; this is not a guarantee that the whole application has no risks.

## Persistence and RLS assessment

Saved catalog applications contain database-generated UUID and `CIV-` reference,
service/module, Auth0 issuer **and** subject, submission/update timestamps,
status/revision, full original/current answer snapshots, and consent/demo flags.
Linked history records include revision, actor, timestamp, transition and notes.
Details reload answers/history and offer escaped HTML downloads. Submissions and
status actions use stable retry UUIDs; writes/history are atomic; stale revisions
are rejected. Failed storage is displayed as an error, never a fabricated save.

RLS restricts application reads to the verified configured issuer/audience and
subject; event reads inherit ownership. `anon` cannot read these tables. Browser
roles have SELECT only, not direct INSERT/UPDATE/DELETE. SECURITY DEFINER RPCs
use a fixed empty search path and explicitly verify both issuer and subject
before mutation. They validate payloads and preserve owner-scoped idempotency.

SQL tests prove user A/B isolation for reads, history and guessed-ID actions,
including wrong-tenant, wrong-app and unverified claims. Client/browser tests
cover disposal, account switching and delayed responses. The owner's live test
confirms one real signed session. A second-account live check remains part of
release smoke testing; synthetic SQL claims do not prove hosted JWT verification.

## Housing, Doctor and Autism recommendation

Reuse the same Auth0 ownership, RLS tables, history and retry architecture, **in a
separate incremental migration**. The table constraints anticipate these modules,
but the applied RPC/client contract intentionally accepts only `service`.
Changing a module field or sending arbitrary JSON is not sufficient.

| Flow | Required persistence work while keeping its UI | Rough engineering estimate |
| --- | --- | --- |
| Shared support | Versioned module payload contracts, server validation, RPCs, optimistic revisions, adapter mapping and tests | 1–2 days |
| Housing | Intake + eligibility snapshot; persisted document-ready toggles; read/restore and explicit withdrawal | 0.5–1 day |
| Doctor | Intake + selected clinic/match snapshot; verification updates; preserve prototype queue semantics | 1–2 days |
| Autism | Intake/triage snapshot plus independently identified funding claims and validated claim-status history | 2–3 days |
| Integration | Cross-account, reload, concurrency, retry and existing-UI regressions across all modules | 1–2 days |

Estimate: roughly **5.5–10 focused engineer-days**, not a commitment; rules review
and any real-data requirements add work. Start with Housing. Keep calculated
snapshot/rule versions so later rule changes do not silently rewrite saved
results. Do not automatically upload existing local records; any explicit import
needs test-data consent and validation. No module redesign/migration was performed.

## Production configuration

The four values must refer to the **same already-configured Auth0 SPA and Supabase
project** as the successful live test. A different tenant/project needs separate
reviewed setup and is not covered by the existing SQL confirmation.

| Vercel setting | Required value |
| --- | --- |
| Git Production Branch | `main` (verify in dashboard; no repository override found) |
| Framework | Vite |
| Root Directory | `civicos-app` |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Node | Supported version meeting Vite/Supabase requirements: Node 22.12+; audit tests ran on 24.21.0 |
| Production domain | `www.civicos.work` |
| Apex | `civicos.work` → `https://www.civicos.work` redirect |

| Production build variable | Value type |
| --- | --- |
| `VITE_AUTH0_DOMAIN` | Existing Auth0 hostname, no scheme/path |
| `VITE_AUTH0_CLIENT_ID` | Existing CivicOS SPA client ID |
| `VITE_SUPABASE_URL` | Existing project's HTTPS URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Existing `sb_publishable_...` key |

No database password, service-role/secret key or Auth0 Client Secret is required.
No redirect environment variable is needed. `auth0ReturnTo` remains
`window.location.origin`, used for login and logout. Vite embeds these public
values at build time; an environment change requires a new build.

`GEMINI_API_KEY`, `ELEVENLABS_API_KEY` and optional voice/model settings belong
only to actual server runtime configuration. They are unnecessary for persistence.
Existing docs describe local dev/preview use; they do not create Vercel functions.

Auth0 Application → Settings:

| Setting | Exact expected configuration |
| --- | --- |
| Application Type | Single Page Application |
| Allowed Callback URLs | `http://localhost:5173, https://www.civicos.work` |
| Allowed Logout URLs | `http://localhost:5173, https://www.civicos.work` |
| Allowed Web Origins | `http://localhost:5173, https://www.civicos.work` |
| Application Login URI | Blank for this app-initiated login flow |
| Token Endpoint Authentication | None |
| Grants | Authorization Code and Refresh Token |
| Refresh Token Rotation | Enabled; retain the working expiry/rotation settings |
| Signing algorithm | Retain the working asymmetric configuration (RS256) |
| Application metadata | `civicos_require_verified_email` = string `true` |
| Post Login flow | Keep Require verified email and CivicOS — Supabase role Actions deployed and attached |

Keep the role Action's literal ID-token `role: authenticated` claim, and Supabase
Third-Party Auth → Auth0 integration enabled. No new audience or callback path.
No blanket wildcard preview URL. A Vercel preview without its own allowlisted
origin cannot be used for live login; use the tested local branch or a separately
approved fixed preview origin rather than broadening production auth allowlists.

Routing is hash-based: `/#/`, `/#/housing`, `/#/doctor`, `/#/autism`, `/#/alerts`.
These refresh through `/`; callback query parameters also arrive at `/`.
`/housing` is not an app-generated route and currently 404s. No catch-all rewrite
was added: it would not convert pathname navigation to hash navigation and could
mask missing APIs with HTML. A future history-router change must include hosting
fallback rules. No active dev-tunnel or localhost-only auth redirect was found.
Remaining localhost uses are local docs/tests, development server configuration,
local Supabase validation, and a URL-parsing base inside server middleware.

## Verification

From `civicos-app`:

```sh
npm run test:db
npm run test:persistence
node --test auth0/require-verified-email.test.cjs
npm run test:production
npm run test:persistence-ui
npm run typecheck
npm run build
npm run lint
npm audit --omit=dev
```

Browser tests use installed Google Chrome and project-local Playwright. The
persistence harness runs actual migrations in isolated PostgreSQL on test port
5174. Production browser tests build into a temporary directory using public test
identifiers, then intercept every request; they cannot modify the live database.
Tests and useful documentation are kept. Demo data remains explicitly opt-in and
browser-only; test harnesses/SQL generators are not imported by the production entry.

Expected audit results: 31 SQL tests, 14 client tests, 4 Auth0 tests, 1 build-security
test and 6 browser tests pass; build/lint/typecheck pass. Existing Vite
`advancedChunks` deprecation warning is non-blocking. Deliberately rejected
session tests produce SDK Realtime bootstrap warnings, without credential values.

## Push databaseUpdate and merge safely

After the manual checkpoint is confirmed, from the repository root:

```sh
git switch databaseUpdate
git status --short
git fetch origin
git log --oneline --left-right databaseUpdate...origin/main
git merge origin/main
```

The audit integration already contains main at `314acba`. The last command should
say up to date unless teammates have added commits. If main advanced, resolve
individual conflicts on databaseUpdate, retain both sides' behavior, and rerun
all checks before pushing. Do not rebase shared history or force-push. Do not add
the unrelated root lockfile change unless its author intends it.

Once the tested integration commit is present and no unresolved merge remains:

```sh
git diff --check
git diff --cached --check
git push -u origin databaseUpdate
```

This pushes only databaseUpdate; it does not change main. It may trigger a Vercel
Preview deployment. Do not test real login on an unallowlisted preview hostname.

1. Open a GitHub pull request with **base main**, **compare databaseUpdate**.
2. Include the test results, persistence scope, security checkpoint and external
   API limitations. Ask a teammate to review the layout/i18n/feature integration.
3. Ensure main has not moved since testing. If it has, merge origin/main into
   databaseUpdate again and rerun checks; push that branch normally.
4. Verify the four Vercel Production values, production branch/root/build settings,
   applied database and exact Auth0 allowlists. Do not rerun migrations.
5. **Wait for explicit approval to merge the PR.** Prefer GitHub's merge commit
   option to retain the already-integrated branch history. Do not push main
   directly or deploy the feature branch as Production to bypass approval.
6. After approval and the PR merge, watch the Vercel deployment sourced from main,
   then perform the production checklist below.
7. If it fails, stop new submissions and report the visible error. Roll back the
   frontend deployment/PR through the team process; do not drop tables or delete
   saved records as a frontend rollback step.

## Production smoke checklist (after approved deployment)

- [ ] Apex redirects to `https://www.civicos.work`; root loads without runtime errors.
- [ ] Search, sidebar, English/French, benefits finder, mobile layout and existing
  Housing/Doctor/Autism entry pages still work. Refresh each hash route above.
- [ ] Profile → Sign in uses Auth0 and returns to `https://www.civicos.work`, never
  localhost/tunnel. An unverified account is denied by Auth0.
- [ ] Submit GST with synthetic inputs (Single, income 12345, one child, filed
  taxes Yes, both test/consent acknowledgments). Await saved confirmation and
  `CIV-` reference; on error use the same retry rather than a fresh submission.
- [ ] Confirm the Supabase row, then refresh and open saved details. Answers,
  reference and timestamp match. Download and inspect the escaped review packet.
- [ ] Exercise own-record prototype review → request information → test response
  → completion. Refresh and confirm status/history. Use another test application
  to check withdrawal; record/history must remain.
- [ ] Logout clears private views/drafts; login restores the same saved record.
- [ ] A second verified account cannot list, read history or mutate the first
  account's application, including a known-ID attempt through the application
  client. Do not use a service-role key or SQL Editor to simulate this test.
- [ ] Offline/failed storage shows an error with no fake saved confirmation or
  demo fallback. Retry retains the same operation key; verify no duplicate row.
- [ ] Inspect network requests without sharing JWTs: correct Supabase project,
  no private keys, no dev-tunnel/localhost endpoints. Auth0 logout returns to www.
- [ ] Confirm optional API limitations are accepted or independently resolved:
  live feeds/paid voice/Gemini are not enabled merely by this persistence release.
- [ ] Local `http://localhost:5173` sign-in, save and logout still work.

References: [Vite environment exposure](https://vite.dev/guide/env-and-mode),
[Auth0 React SDK](https://auth0.com/docs/libraries/auth0-react),
[Supabase Auth0 ID-token integration](https://supabase.com/docs/guides/auth/third-party/auth0),
[Vite hosting and SPA routes on Vercel](https://vercel.com/docs/frameworks/frontend/vite).
