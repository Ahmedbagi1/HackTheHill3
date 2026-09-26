# CivicOS Auth0 setup and verification

The repository integrates `@auth0/auth0-react`. Credentials are collected only by
Auth0 New Universal Login. The profile icon opens the local account dialog; Sign In,
Create Account, password reset and Sign Out use Auth0. No local accounts, passwords,
custom token issuer, or Management API credentials are involved.

**Required before strict email verification is enforced:** configure the application
metadata below, deploy `auth0/require-verified-email.cjs`, and attach it to the Login
flow. The frontend verification message does not enforce authorization. Repository
code does not deploy an Action or change your tenant settings.

## Local configuration

In `civicos-app/.env.local`:

```dotenv
VITE_AUTH0_DOMAIN=your-auth0-domain
VITE_AUTH0_CLIENT_ID=your-auth0-client-id
```

Use the real SPA application's identifiers locally. The domain is a hostname without
`https://` or a path. `.env.local` is ignored by the existing `.gitignore`; the committed
`.env.example` contains only placeholders. These two identifiers are public browser
configuration, not secrets. Never add a Client Secret. Restart Vite after changing them.

```sh
cd civicos-app
npm install
npm run dev
```

Open **http://localhost:5173**. Vite uses port 5173 with `strictPort`, so it fails rather
than silently selecting an origin absent from the Auth0 allowlists. Do not use
`127.0.0.1`, a LAN IP, or preview port 4173 with the current dashboard settings.

## Required Auth0 dashboard configuration

### 1. Application and sessions

Open **Applications → Applications → CivicOS → Settings**:

| Setting | Value |
| --- | --- |
| Application Type | Single Page Application |
| Application Login URI | Leave blank for the current app-initiated flow |
| Allowed Callback URLs | `http://localhost:5173` |
| Allowed Logout URLs | `http://localhost:5173` |
| Allowed Web Origins | `http://localhost:5173` |
| Refresh Token Rotation → Allow Refresh Token Rotation | Enabled |
| Rotation Overlap Period | `3` seconds |

Under **Advanced Settings → Grant Types**, ensure **Authorization Code** and
**Refresh Token** are enabled. If the Token Endpoint Authentication Method setting is
shown, it must be **None** for this public SPA. Keep OIDC Conformant enabled. Save changes.

Use expiring refresh tokens. For local development, recommended maximum lifetime is
`2592000` seconds (30 days) and idle lifetime `604800` seconds (7 days). Set these in the
application's Refresh Token Expiration settings if available.

The SDK uses its supported `cacheLocation="localstorage"` and `useRefreshTokens`
options. It requests `offline_access` itself, manages the token cache, and renews
sessions with Auth0. This supports reloads without relying on third-party iframe
cookies. CivicOS never reads or writes tokens directly. Browser-readable storage is
a deliberate persistence tradeoff; avoid adding untrusted scripts. Clearing site data,
private browsing, revoked/expired refresh tokens, or tenant session policies can require
sign-in again. No custom API audience is configured because this app has no protected
business API. If one is added later, configure its audience and Allow Offline Access,
and validate access tokens server-side.

Reference: [Auth0 refresh-token rotation](https://auth0.com/docs/secure/tokens/refresh-tokens/configure-refresh-token-rotation)
and [SDK persistence options](https://auth0.com/docs/secure/tokens/refresh-tokens/use-refresh-token-rotation).

### 2. New Universal Login and the database connection

1. Open **Branding → Universal Login → Advanced Options** and confirm the **New**
   Universal Login experience is selected (some tenants show this in the main Settings
   tab). Keep any Classic Login custom page override disabled.
2. Open **Authentication → Database → Username-Password-Authentication → Settings**.
   Keep **Requires Username** enabled and **Disable Sign Ups** disabled. On tenants
   showing identifier attributes instead, require both username and email at signup
   and enable the intended username/email login identifiers.
3. In that connection's **Applications** tab, enable **CivicOS**.
4. Start from CivicOS, not a bookmarked `/u/login` URL. The SDK sends
   `connection=Username-Password-Authentication`; Create Account also sends
   `screen_hint=signup`. Auth0 owns username/email/password validation and the supported
   username/email login behavior. The Sign In button explicitly prompts for login,
   so users can switch accounts and retry after verification.
5. The Auth0-hosted Sign In screen should offer **Reset password** (sometimes labelled
   **Forgot password?**). Use its email-based
   reset flow. If unavailable, check the database connection and Universal Login settings;
   CivicOS does not implement a separate reset endpoint.

Reference: [Auth0 Universal Login](https://auth0.com/docs/authenticate/login/auth0-universal-login)
and [React SDK](https://auth0.com/docs/libraries/auth0-react).

### 3. Enforce verified email in Auth0 (mandatory)

1. Open **Applications → Applications → CivicOS → Settings → Advanced Settings →
   Application Metadata**. Add **key** `civicos_require_verified_email`, **value** `true`
   (the string `true`), then **Save Changes**. This is application/client metadata,
   not user metadata. Do not set it on unrelated apps unless they need the same policy.
2. Open **Actions → Library → Build Custom** (or **Create Action → Build Custom**).
   Name it **CivicOS — Require verified email**, select **Login / Post Login**, and use
   the dashboard's current supported Node.js runtime.
3. Replace the editor contents with the entire contents of
   [`../auth0/require-verified-email.cjs`](../auth0/require-verified-email.cjs).
   No dependencies or secrets are required. Click **Deploy**.
4. Open **Actions → Flows → Login** (called **Actions → Triggers → post-login** in some
   dashboard versions). Drag the deployed Action from **Custom** between **Start** and
   **Complete**. Click **Apply**. Deploying alone does not attach the Action.
5. Before testing, sign out of any pre-existing CivicOS session. Previously issued
   tokens are not retroactively invalidated by attaching an Action. To revoke existing
   sessions/grants, use the user's session/authorized-application controls in the dashboard.
6. Test a new unverified signup and a verified sign-in using the checklist below.
   Inspect **Monitoring → Logs** for denied/successful logins and Action failures.

For this application's metadata flag, the Action denies login unless an email exists
and `event.user.email_verified === true`. It also checks refresh-token exchanges.
Other applications are unaffected. **Omitting the metadata flag skips the policy**;
both the flag and flow attachment are mandatory. The frontend uses the denial marker
`CIVICOS_EMAIL_UNVERIFIED` to show verification instructions and retry/sign-out controls.
It additionally avoids displaying an unverified session as a completed sign-in, but
that UI is not the security boundary. No authorization protection was added to the
existing public dashboard, government wizards, or ElevenLabs proxy.

Reference: [application metadata](https://auth0.com/docs/get-started/applications/configure-application-metadata),
[deploying and attaching Actions](https://auth0.com/docs/customize/actions/write-your-first-action),
and [`api.access.deny`](https://auth0.com/docs/actions/reference/post-login/post-login-api-object#api-access-deny-reason).

### 4. Verification and password-reset emails

1. Open **Branding → Email Templates → Verification Email (using Link)**. Ensure it is
   enabled. Keep the Auth0-generated verification URL in the template.
2. Check **Change Password** / **Password Reset** email delivery as well.
3. Under **Branding → Email Provider**, verify the delivery setup. Auth0's built-in
   provider is for testing and has restrictions; configure your own supported email
   provider when reliable delivery is needed. Provider credentials belong in Auth0,
   never in Vite environment variables.
4. A new signup should receive the verification link. Denied sign-in does not itself
   resend the email. For a missing/expired link, open **User Management → Users →
   the user → Actions → Send Verification Email** (also available beside the email
   verification status in some dashboard versions). Then ask the user to open the
   link and return to CivicOS → Profile → Sign In.
5. Keep the application Login URI blank for now. After verifying or resetting a
   password, manually return to localhost and sign in if Auth0 does not return there.
   Do not configure an email redirect to a nonexistent `/callback` route.

Reference: [verification email behavior](https://auth0.com/docs/manage-users/user-accounts/verify-emails)
and [email templates](https://auth0.com/docs/customize/email/email-templates).

## CivicOS Universal Login branding

In **Branding → Universal Login → Customization Options**, apply these values and
click **Save and Publish**. They come from `src/styles/tokens.css`, `base.css`,
`components.css`, `layout.css`, and the new account dialog, not a generic theme.

| Editor setting | Recommended value |
| --- | --- |
| Primary button; links; base focus | `#4f46e5` |
| Primary button label | `#ffffff` |
| Base hover | `#4338ca` |
| Page background | `#f8fafc`, solid, no background image |
| Widget and input backgrounds | `#ffffff` |
| Header and filled input text | `#0f172a` |
| Body text / muted copy | `#64748b` |
| Secondary button label | `#334155` |
| Input labels | `#334155` |
| Input placeholders and icons | `#94a3b8` |
| Widget border | `#e2e8f0` |
| Input and secondary-button borders | `#cbd5e1` |
| Error | `#e11d48` |
| Success | `#059669` |
| Borders → Widget corner radius | `14px` |
| Borders → Button style / radius | Rounded / `6px` |
| Borders → Input style / radius | Rounded / `6px` |
| Widget, button and input border weight | `1px` |
| Borders → Shadow | Enabled |
| Fonts → Reference size | `15px` |
| Fonts → Title | `24px`, bold |
| Fonts → Body/subtitle | `14px` |
| Fonts → Buttons, labels, links | `14px`; bold buttons |
| Widget / page placement | Centered; heading text left aligned |
| Logo height | `34px` |

CivicOS declares `Inter` first, followed by system sans-serif fonts; it currently does
not download a font file. If you have a licensed, publicly hosted Inter WOFF asset
with CORS enabled, supply its HTTPS URL under Fonts; otherwise keep a sans-serif
fallback. Do not invent a font URL. For the logo, use a published SVG export of the
existing white Landmark mark on its `#4f46e5` → `#7c3aed` gradient, with 10px corners.
The repository favicon is a starter asset and does not match that header mark. Until
you have a public HTTPS logo URL, leave the logo unset; do not use a localhost URL.
Auth0's no-code editor exposes
a shadow toggle, not CivicOS's exact custom CSS shadow/gradient. No custom login page
template or password form is needed.

Where **Customize Text** is available, set login title to **Sign in to CivicOS**,
signup title to **Create your CivicOS account**, and retain the built-in password-reset
and verification instructions. Preview login, signup, reset, success and error prompts.

Reference: [Auth0 no-code theme settings](https://auth0.com/docs/customize/login-pages/universal-login/customize-themes).

## Test checklist (real accounts, after dashboard setup)

1. **Create an account:** Start Vite and open localhost. Profile → Create Account.
   Confirm the address bar is your Auth0 domain. Use a real email inbox you control,
   a unique username and a password accepted by Auth0. Submit on Auth0 only.
2. **Confirm persistence:** In **User Management → Users**, find that email. Confirm
   the database connection, username and initially unverified email status. No user
   should be created in CivicOS browser storage as a separate local account.
3. **Enforcement before verification:** Attempt Sign In with the correct password
   before opening the email link. Auth0 must deny sign-in. CivicOS should show the
   verification instructions, with the dashboard still usable. If sign-in completes,
   stop and recheck both the metadata flag and Action flow attachment.
4. **Verify:** Open the verification email link. Check that Auth0 now shows
   `email_verified: true`. Return to CivicOS and click **I’ve verified my email — Sign In**.
   Authenticate. Profile must display available real Auth0 name/nickname/email/picture.
5. **Sign out:** Profile → Sign Out. Confirm return to localhost, then reopen Profile;
   it must offer Sign In and Create Account. Refresh and confirm it remains signed out.
6. **Returning account:** Sign in using the same account. It should resolve to the
   same Auth0 user ID, not a newly created account.
7. **Wrong password:** Sign out, then submit the known account with an incorrect
   password on Auth0. It must fail there; CivicOS must not show a signed-in profile.
8. **Nonexistent account:** Attempt Sign In with an unused username/email and a
   password. Auth0 must reject it; do not submit the signup form for this test.
9. **Username login:** Sign out and sign in with the saved username and correct
   password. Confirm the same Auth0 user.
10. **Email login:** Sign out and repeat with the saved email. If the tenant's selected
    identifier configuration disallows it, adjust that connection in Auth0; CivicOS
    intentionally does not implement an alternate credential validator.
11. **Password reset:** Sign out → Sign In → Reset password. Enter your real account
    email, follow the delivered link, choose a new password, and sign in with it.
    Verify the old password fails. Do not share either password with collaborators.
12. **Refresh/session restoration:** While signed in, reload localhost, close and reopen
    the tab, and open Profile. The same user should remain signed in while the SDK cache
    and refresh session remain valid. To test renewal, use a short test token lifetime
    in Auth0, wait for expiry, then reload; inspect `/oauth/token` success in DevTools
    without copying tokens into logs. Restore the previous lifetime afterward.
13. **Logout again:** Sign Out, reload, and confirm no profile remains. Auth0 logout
    clears the app's SDK session and the Auth0 SSO session; no separate government
    account or third-party identity-provider logout is implied.
14. **Errors and UI regression:** Cancel a login or load an invalid callback; the
    dashboard must remain available and show a recoverable account error. Check Tab /
    Shift+Tab, Escape, close button, backdrop, restored focus, and a narrow mobile viewport.
    Try service search, a wizard, and the benefits finder as before.

## Local checks and limits

```sh
npm run build
npm run lint
node --test auth0/require-verified-email.test.cjs
git check-ignore -v .env.local
```

The Action tests cover verified/unverified/missing claims, refresh exchanges and
scoping to opted-in applications. They are isolated policy tests, not mock login code.
There was no existing test runner or authentication implementation to remove.
Local implementation checks passed: production build, lint with no warnings, four
Action tests, and Chrome checks of mobile layout, focus containment/restoration,
dialog closing, missing configuration, malformed callbacks and verification-error UI.
Service search, life-event checklists, the application wizard and benefits-finder
progression also passed browser regression checks after using the account dialog.
The configured tenant's live signup screen was confirmed to request username, email
and password; login was confirmed to offer username/email and a working navigation
to the email-based reset screen. The SDK's real authorization request included PKCE,
the configured client/connection, localhost callback and `offline_access`. An injected
denial callback tested UI handling only; the real Auth0 logout endpoint returned to
localhost without an authenticated session. No account credentials were submitted.
The build emits a non-fatal warning for the approximately 627 kB minified JS bundle
(190 kB gzip); no unrelated bundle refactor was made.

Live account creation, email delivery, verified login, token renewal and logout require
the real tenant settings and a real account; local policy/UI tests do not prove them.

## Production later

Set these same two `VITE_AUTH0_*` values in the deployment's build environment, add the
exact HTTPS production origin to all three Auth0 allowlists, and rebuild. The SDK's
callback and logout targets use `window.location.origin`, so no code change is needed
for another root-hosted origin. Keep localhost entries for development. Hosting under
a subpath would require explicit callback/base-path changes. Use a real email provider
and public HTTPS logo/font assets when you publish.
