# Gemini: shared local and production API

Complete on `databaseUpdate`; no push, main merge or deployment performed.
The owner confirmed the replacement private key, removal of the public variable,
and publication of the Vercel POST rate-limit rule (10/IP/60 seconds, HTTP 429).
There is no outstanding Gemini setup checkpoint. Deployed routing has not been
independently verified; the owner requested completion without another test phase.
This is **API-only**. Existing Smart Triage, AI Explain and Quick Auto-Fill
components are preserved but remain unmounted, per the owner's explicit choice.

## Request path

```text
Browser clients (no key)
  /api/gemini/status                  GET
  /api/gemini/triage                  POST
  /api/gemini/simplify                POST
  /api/gemini/extract                 POST
       |
       +-- local: Vite geminiProxy middleware
       +-- Vercel: api/gemini/[task].js (Node.js function)
                        |
              createGeminiHandler in server/geminiProxy.js
                        |
              Google SDK / gemini-3.5-flash-lite
```

The Vercel function reads **`process.env.GEMINI_API_KEY`** at runtime. The local
Vite config loads the ignored environment file into the private Node environment;
the same handler reads `process.env.GEMINI_API_KEY`. Neither path puts the key in prompts, JSON responses, error
logs or browser configuration. SDK construction is lazy. No new dependencies.
The four existing public Auth0/Supabase variables remain the only explicit Vite
build definitions. No legacy Gemini environment-variable lookup remains in
active application/server/configuration code; its name remains only in historical
security notes and a deliberate negative build test.

Vercel project Root Directory must remain **civicos-app**, with Vite / `npm run
build` / `dist`. `api/gemini/[task].js` is inside that project root, outside `src`
and `public`. Vercel discovers and packages it separately from static assets.
`vercel.json` sets a 35-second maximum for these functions. No catch-all rewrite
is added; it could hide missing API routes behind SPA HTML. Hash routes, Auth0
callbacks, Supabase and the existing voice/feed middleware are unchanged.
The voice/feed middleware still has no production function adapter.

The previous `gemini-2.5-flash` model returned Google HTTP 404 during the live
check with the replacement key. The handler now uses stable
`gemini-3.5-flash-lite` with minimal thinking; a real synthetic simplify request
through the local Vercel entrypoint returned HTTP 200 and valid output.
Google documents this model's supported thinking settings in its
[thinking guide](https://ai.google.dev/gemini-api/docs/thinking).

## Failure and resource controls

- Missing runtime key: status returns `enabled: false`; task POST returns 503
  `DISABLED`, never a fabricated model response.
- Status is GET-only; tasks are POST-only. Unknown tasks return 404; wrong methods
  return 405 with `Allow`.
- POST requires an allowlisted Origin and JSON Content-Type; no cross-origin CORS
  grant. Production allows `https://www.civicos.work`. A Vercel Preview allows
  its exact deployment URL from Vercel's own `VERCEL_URL`, only in Preview.
  Local middleware allows localhost 5173 and the default preview port 4173.
- JSON must be an object, no more than 64 KiB. Both raw Node streams and Vercel's
  parsed-body helper are supported. Slow local streams expire after five seconds.
- Existing task-specific input limits and required fields are retained. Model,
  prompt templates and output schema are server-controlled, not request options.
- Upstream time is capped at 25 seconds, output at 2,048 tokens; SDK automatic
  retries are disabled. Timeouts return 504, upstream quota errors 429, other
  failures 502. Invalid/empty model responses fail rather than masquerading as
  successful output. Server and client both validate response shape.
- Four concurrent calls and 30 attempts/minute per warm handler instance limit
  local bursts. Slots are released after failure. `Retry-After` accompanies 429s.
- Responses use `no-store` and `nosniff`. Raw SDK/provider error bodies, keys and
  citizen input are not logged or echoed. Browser errors use bounded messages,
  including non-JSON firewall responses.

**Origin checking is not authentication**: non-browser callers can forge it.
Per-instance limits reset on cold starts and do not coordinate across instances.
The API stays public to preserve its existing guest-facing contract. Deploy the
edge rule below before exposing paid generation. Rate limits reduce abuse but
are not a global spend cap; maintain appropriate Google project quotas as well.
No Auth0 gate, Supabase table or dashboard configuration was changed.

## Vercel setup reference (completed by owner)

Do not merge or push main to test this.

1. Vercel → CivicOS project → Settings: confirm Root Directory `civicos-app`,
   framework Vite, build `npm run build`, output `dist`, supported Node 22.12+
   (local checks use Node 24). Keep Production Branch `main`.
2. Environment Variables: confirm the existing private `GEMINI_API_KEY` is enabled
   for Production. For a protected Preview of databaseUpdate, scope a private key
   to that branch's Preview environment too. Do not expose it as a public Vite
   variable. Existing deployments do not gain new code/environment values until
   rebuilt. The owner already confirmed rotation and removal of the old variable.
3. **Firewall → Configure → New Rule**:
   - Name: `CivicOS Gemini generation`.
   - Conditions (AND): Request Path starts with `/api/gemini/`; Request Method
     equals `POST`.
   - Action: **Rate Limit**, **Fixed Window**, **60 seconds**, **10 requests**,
     counting key **IP**, enforcement **Default (429)** (not Log).
   - Save Rule → Review Changes → Publish. This publishes a firewall rule, not a
     code deployment. Confirm it is applied to the intended deployment environment.
     If the plan's available rule is already used, coordinate with the team;
     do not replace an existing protection blindly.
4. Review Google's existing model quotas/spending controls for the intended demo
   load; WAF counters are per region and do not guarantee a global billing cap.
5. The owner confirmed the required setup. No action was taken in Vercel or
   Google by this implementation. No new Supabase/Auth0/SQL action is needed.

## Local verification

Save the replacement key as `GEMINI_API_KEY` in ignored `.env.local`, then restart
Vite. Do not paste the key into curl commands or browser code.

```sh
cd civicos-app
npm run dev
```

In another terminal:

```sh
curl -i http://localhost:5173/api/gemini/status
curl -i http://localhost:5173/api/gemini/simplify \
  -H 'Origin: http://localhost:5173' \
  -H 'Content-Type: application/json' \
  --data '{"lang":"en","service":{"title":"Synthetic test program","summary":"A fictional program for adult residents.","requirements":["A completed test form"],"time":"Check the official site."}}'
```

Expect status `enabled: true`, then HTTP 200 containing `whoQualifies`, `documents`
and `timeAndFees`. This POST makes one real Google request and may use credits.
A 429/502/504 is a real failure, not a successful smoke test. Report only the
safe response code/message; do not share environment values or raw provider logs.
Removing the key and restarting should yield disabled status and 503 for the
POST. Malformed JSON gives 400; foreign/missing Origin gives 403; non-JSON gives
415; unknown task 404. No failure should produce an invented AI answer.

Automated checks (use no real Google credentials or credits):

```sh
npm run test:gemini
npm run test:production
npm run build
npm run lint
npm run typecheck
```

Gemini tests include all task schemas, failure paths, timeout and budget behavior,
frontend same-origin calls, and the **actual Vercel entrypoint over a local HTTP
server using the actual Google SDK with a stubbed upstream transport**. That test
verifies the runtime key reaches only Google's request header. It validates Node
adapter behavior, not Vercel's deployed routing or the real key's permissions.

Validation on this branch: 13 Gemini tests, the production environment
allowlist test and all six browser regression tests passed; build, lint and
TypeScript checks passed. A separate real
Google request through the Node entrypoint passed after the model update. The
generated browser files contained neither the configured replacement key, the
Gemini secret variable name, nor a Google API-key pattern. The revoked key is no
longer available locally for a literal comparison; the negative build test also
checks that a legacy public-prefixed Gemini variable cannot enter the bundle.
The build retains an existing `advancedChunks` deprecation warning.

## Vercel smoke test after an authorized deployment

Use a protected Preview of databaseUpdate first, with the appropriate runtime
secret scope. No Auth0 Preview allowlist change is needed for these public API
checks. The deployment URL's Origin must match exactly; use the immutable URL
listed by Vercel, not an arbitrary alias. Through an authenticated Preview browser
(if deployment protection is enabled), open `/api/gemini/status`, then issue a
same-origin POST from DevTools with the same synthetic JSON as above. Never put
the key in the request.

After a separately approved production merge/deploy, repeat the curl commands
using `https://www.civicos.work` in both the endpoint and Origin header. Verify:

1. Status is JSON with `enabled: true`, not HTML or 404.
2. Simplify returns the three summary strings; triage/extract use the same route
   family and retain their existing client contracts.
3. Requests go to your own `/api/gemini/*`; only the Node function calls Google.
4. Missing/bad input returns the documented status. Test the WAF by repeated
   **invalid** POSTs, not costly valid generations; requests over the edge limit
   should return 429. Check the rule's matching traffic in Firewall.
5. Vercel function logs contain no keys, citizen text or raw upstream errors.
6. Browser assets contain no Gemini secret name/value or Google API-key pattern.
7. Ordinary UI, Auth0 login/logout and saved applications still work.

The current AI components are not mounted. API-only deployment does not make new
AI buttons appear; reconnecting them is a separate explicitly requested task.

References: [Vercel Node.js functions and parsed bodies](https://vercel.com/docs/functions/runtimes/node-js),
[Vercel WAF rate limits](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting).
