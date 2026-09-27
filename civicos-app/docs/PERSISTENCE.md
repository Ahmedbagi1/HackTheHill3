# CivicOS persistence setup

## Current checkpoint: stage 3 authenticated live check passed

On 2026-09-27 the owner confirmed a verified Auth0 login, GST submission with a
`CIV-` reference, the matching Supabase row, retained answers after refresh,
private-view removal on logout, and restoration on login. This is a successful
live authenticated persistence check. It does not establish a second-account
isolation test or production deployment of this branch.

See [production readiness and branch integration](PRODUCTION_READINESS.md) for
the current audit, security fix, deployment limitations and release checklist.

The user confirmed both SQL bundles were applied successfully. **Do not rerun
either `setup.local.sql` or `application-api.local.sql`.** No further database,
Auth0 or Vercel configuration is required for the 29 catalog forms in this stage.

The existing wizard now sends full form answers to Supabase and waits for a
database response before showing confirmation and its database-generated
reference. It requires a verified login, consent and a test-information
acknowledgment. Uncertain saves keep the same answers and request key for retry;
they do not show success, write to localStorage, or load a demo fallback. If you
close a form after a network error, check saved applications before starting a
new application: the server may have committed even if its response was lost.

Your requests loads account-owned applications from Supabase with loading/error
states, refresh and pagination. View details reloads full saved answers and
recorded history, downloads the saved review packet, and offers explicitly
labelled prototype actions. Statuses never advance based on elapsed time.
Withdrawal preserves the record and history. Account changes/logout remount the
private UI, dispose the previous database client, and clear open details/drafts.

Housing, doctor and autism modules and old browser/demo records retain their
existing functionality, with **Browser-only prototype** labels in the tracker.
They are not silently uploaded or used as a fallback for failed Supabase reads.
Extending persistence to those specialized intakes remains a separate stage.

### Live regression checklist with your verified account

1. Open `http://localhost:5173`. If the local server is stopped, run `npm run dev`
   from `civicos-app`. Use **Profile** to sign in. Sign out/in once if your current
   session predates the role Action. Do not share credentials or JWTs.
2. In services, search **GST** and start **GST/HST Credit**. This form needs no
   government identifier. Use test inputs: **Single**, income **12345**, children
   **1**, filed taxes **Yes**. Review the answers and check both consent boxes.
3. Submit. Expect **Saved to your CivicOS account** and a `CIV-` reference. If
   there is an error, stop and report its visible text; do not repeat with a new
   application or load demo data. **Retry save** retains the original request key.
4. Close the wizard and open the dashboard (`http://localhost:5173/#/`). Refresh
   the page, then open **Your requests → View details**. Confirm the saved values
   and reference match. Download the saved application and inspect the packet.
5. Try **Start prototype review → Request test information**, enter a test-only
   response, then **Send test information → Complete prototype review**. Refresh
   and confirm the status and all history entries remain.
6. Sign out: the saved record and any open details must disappear. Sign back in:
   the same record must return. If you already have a second verified test account,
   confirm it cannot see this record. Share pass/fail and any visible error text.

These actions save a test application to the real CivicOS database. They do not
contact government case systems. This check uses the local app with your real
configured Auth0/Supabase projects; the updated frontend has not been deployed
to Vercel by this work.

### Checks completed and their limits

- SQL policy/API tests: 31 passing, including all 29 catalog forms, custom and
  conditional validation, ownership, lifecycle, idempotency and atomic history.
- Supabase client tests: 14 passing, including rejected sessions, outages,
  pagination and discarding responses after logout.
- Browser tests exercise the actual React UI and Supabase SDK against the actual
  migrations in isolated PostgreSQL. Only Auth0 and the HTTP boundary are test
  fixtures: these tests cannot prove live signatures/refresh-token renewal.
- Read-only checks against the actual Supabase project confirmed anonymous
  access to health, applications and history is denied (HTTP 401 / `42501`).
- Build, lint and TypeScript checks run locally. Vite retains its pre-existing
  `advancedChunks` deprecation warning.

`npm run test:persistence-ui` uses the project-local Playwright development
dependency and an installed Google Chrome browser. Its isolated Vite server uses
port 5174, disables `.env` files, and intercepts/blocks remote requests. It never
loads the live project's configuration or inserts records into Supabase. Test
artifacts are ignored by Git; no authentication bypass exists in the app entry.
`node scripts/check-supabase-anonymous.mjs` repeats the live read-only check using
only the public project URL/publishable key and prints no credentials or data.

## Stage 2 application API (applied; setup reference only)

Stage 1 is confirmed applied: `applications_rls`, `history_rls`, and
`auth0_configured` were all true, with no SQL errors. **Do not rerun
`supabase/setup.local.sql`.**

Stage 2 was applied using **`supabase/application-api.local.sql`**. It
bundles migrations `202609260002_service_definitions.sql` and
`202609260003_application_api.sql` in a single transaction. It adds:

- A private snapshot of the existing 29 catalog forms' validation rules.
- `submit_application`: validated full answers, verified Auth0 ownership,
  database-generated reference/timestamps and initial history saved atomically.
- `apply_application_action`: revision-checked prototype review, requests for
  additional test information, responses, completion, rejection and withdrawal.
  Withdrawal preserves the application and history. No government processing occurs.
- Owner-scoped submission retry keys and per-application action retry keys.
  Identical retries reuse the record; changed inputs with the same key are rejected.
- Health schema version 2, `write_api_ready: true`, `supported_modules: ["service"]`.

Table ownership/RLS and the Auth0 configuration remain unchanged. Browser roles
still have no direct INSERT, UPDATE or DELETE privileges. The write functions
derive the owner from verified claims and check both issuer and subject explicitly.
No application records are inserted by setup. Housing, doctor and autism have
separate intake contracts and are deliberately rejected by this API until their
integration stage; their existing code is preserved.

`src/services/applicationRepository.ts` is the frontend database adapter. It uses
only the existing four public Vite variables, renews Auth0 through the existing
SDK, passes the role-bearing ID token to Supabase, checks database readiness,
and rejects stale responses on session changes. It has no application storage
or synthetic fallback. Missing setup, invalid sessions, conflicts and network
errors are failures, never successful submissions. A caller must keep the same
UUID request/operation key when retrying an uncertain write; the server may have
committed before the connection was lost. Dispose the adapter and clear private
React state whenever its Auth0 session ends.

The adapter is now connected to the catalog forms and saved-application views,
as described in stage 3 above. Existing specialized modules are preserved.

### Completed manual action (do not repeat in the existing project)

1. Open the existing CivicOS Supabase project, then **SQL Editor → New query**.
   Use the default database owner (`postgres`).
2. Copy the **entire contents** of `supabase/application-api.local.sql` into the
   editor. The file is already prepared; there are no placeholders or secrets
   to enter. Do not copy the old `setup.local.sql` instead.
3. Run the whole script **once**. It checks the foundation first and applies the
   new functions and two event columns together. It does not reset tables, change
   authentication settings, or delete existing data.
4. The final result should be:

   | Column | Expected |
   | --- | --- |
   | `applications_rls` | `true` |
   | `history_rls` | `true` |
   | `auth0_configured` | `true` |
   | `submit_rpc_ready` | `true` |
   | `lifecycle_rpc_ready` | `true` |
   | `supported_service_count` | `29` |
   | `direct_writes_blocked` | `true` |

5. These results were confirmed before frontend activation. If setting up a new project and SQL reports an error,
   stop and share the error text. Do not delete objects or rerun isolated pieces.

No Auth0, Vercel, exposed-schema, database-password, extension or extra dashboard
configuration is needed for this checkpoint. The schema-cache reload is included.
Authenticated health is checked later using a real browser session; the SQL
Editor verification does not manufacture an Auth0 session or prove network access.

### Local verification and maintenance

```sh
npm run test:db
npm run test:persistence
npm run test:persistence-ui
npm run test:production
npm run typecheck
npm run build
npm run lint
```

The API tests execute the **same complete SQL bundle** as the manual step against
in-memory PostgreSQL, then exercise submissions for all 29 forms and their
conditional branches, invalid inputs, ownership isolation, retries, transitions,
responses and transactional rollback. The client tests use the installed Supabase
SDK with test-only HTTP/Auth0 stubs to verify the token, error handling, pagination
and session changes. Test fixtures never enter the runtime or live database.
They cannot prove live token signatures or authenticated hosted database access;
the separately confirmed live check is recorded at the top of this document.

The API requires `{ answers, consent: true, demoAcknowledged: true }`, rejects
unknown fields, strips hidden/empty optional answers, and validates required
fields, choices, patterns, numbers, dates and the existing custom rules. Original
and current payloads initially contain the same normalized complete answers;
responses are stored in history, without overwriting the original submission.
Calendar checks use Ottawa's `America/Toronto` date; timestamps remain UTC instants.

The catalog migration contains static schemas, never submitted data. The small
metadata additions to `fieldBuilders.js`/`servicesData.js` preserve current form
behaviour and let `db:prepare-api` detect drift between forms and SQL. Once these
migrations are applied, future schema changes require a new migration; do not
regenerate and overwrite an applied migration.

## Stage 1: database foundation (applied)

The instructions below document first-time setup for a new project. The current
CivicOS project has already completed them; use only the stage 2 checkpoint above.

The project now includes `@supabase/supabase-js` for the upcoming Auth0-backed
application client. `@electric-sql/pglite` is a development-only dependency that
runs SQL policy tests in memory. It is never used as application storage and
never imported by the frontend.

The first migration prepares two application tables:

- `public.applications`: Auth0 issuer/subject ownership, database-generated IDs
  and references, service/module, demo processing status, original/current JSONB
  payloads, revision, timestamps, summary, and an owner-scoped idempotency key.
- `public.application_events`: linked status history with actor/source, revision,
  timestamp, and optional note. History inherits application ownership.

`civicos_private.auth_configuration` stores just the allowed Auth0 issuer and SPA
Client ID. These are public identifiers, not passwords or application accounts.
Do not expose the `civicos_private` schema in the Supabase Data API.

Supabase verifies Auth0 JWT signatures and expiry. The SQL policies additionally
require the configured issuer/audience, a text subject, `role: authenticated`,
and a boolean `email_verified: true`. They do not use email as the ownership key
or cast an Auth0 subject to a UUID. Missing configuration denies access.

Authenticated users can read only their own rows. No browser role can write to
either table, change ownership, fabricate history, or read configuration. No
application data is inserted by setup. The next migration will introduce
validated submission and lifecycle functions; baseline JSON object/size checks
in this migration are not a replacement for per-service validation.

At the original stage 1 checkpoint the forms used browser storage. The 29 catalog
forms now use Supabase as described above; Housing, Doctor and Autism remain
browser-only. No Supabase error falls back to local/demo data.

## Prepare the SQL locally

From `civicos-app`, run:

```sh
npm run test:db
npm run db:prepare
```

`db:prepare` reads only public Auth0 configuration through Vite's environment
loader and writes `supabase/setup.local.sql`, which is ignored by Git. It does
not contact Supabase. The generated SQL includes the migration and the matching
issuer/Client ID from your local configuration in one transaction. Ensure these
identify the same tenant and SPA used by Vercel. No database password, service-role
key, Supabase secret key, or Auth0 Client Secret is needed.

## Manual action: apply the foundation

Perform this step only after reviewing the prepared file and agreeing to apply it.

1. Open the existing CivicOS project in the **Supabase Dashboard**. Confirm it is
   the project referenced by your local/Vercel `VITE_SUPABASE_URL`.
2. Open **SQL Editor → New query**, using the default database owner (`postgres`).
3. Copy the **entire contents** of `supabase/setup.local.sql` into the editor.
   It already contains your public Auth0 identifiers; there are no placeholders
   to replace and no credentials to paste into chat.
4. Run the whole query once. The DDL, RLS policies, permissions, and Auth0 settings
   are applied together. There are no DROP statements or changes to unrelated
   tables. If a CivicOS table/schema already exists, the transaction fails rather
   than overwriting it. Stop and share the error text instead of deleting objects
   or rerunning pieces of the script.
5. The final result must show **`applications_rls = true`**, **`history_rls = true`**,
   and **`auth0_configured = true`**. Confirm these results before further setup.

No separate dashboard table creation, RLS toggle, exposed-schema change, extension,
or Auth0 Action change is needed. Keep the verified-email and Supabase-role Actions
attached to Post Login. The new health RPC reports `write_api_ready: false` on
purpose until the next stage is implemented and applied.

This is first-time setup, not a reset script. Do not rerun it after a successful
application. Later schema changes will be separate reviewed migrations.

## Verification boundaries

`npm run test:db` executes the actual migration and RLS policies in in-memory
PostgreSQL, with synthetic test-only claims and records. It checks owner isolation,
history isolation, anonymous/unverified/wrong-app denial, restricted writes,
configuration access, database constraints, and duplicate request keys. Those
tests do not prove live Auth0 signature verification, token renewal, network
connectivity, or that the migration has run on Supabase. Live checks follow the
manual database confirmation; no success is inferred from an empty client query.

Reference: [Supabase's Auth0 integration](https://supabase.com/docs/guides/auth/third-party/auth0).
