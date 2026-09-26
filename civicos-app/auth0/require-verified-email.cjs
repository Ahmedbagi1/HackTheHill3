/**
 * Deploy as an Auth0 Login / Post Login Action, then attach to the Login flow.
 * On the CivicOS application, set metadata civicos_require_verified_email=true
 * (the string "true"). This scopes the policy to explicitly enabled apps.
 * See ../docs/AUTH0.md. No dependencies or secrets are required.
 */
exports.onExecutePostLogin = async (event, api) => {
  if (event.client.metadata?.civicos_require_verified_email !== "true") return;

  // Applies to interactive sign-in and refresh-token exchanges alike.
  if (!event.user.email || event.user.email_verified !== true) {
    api.access.deny(
      "CIVICOS_EMAIL_UNVERIFIED: Verify your email using the link in your inbox, then sign in again.",
    );
  }
};
