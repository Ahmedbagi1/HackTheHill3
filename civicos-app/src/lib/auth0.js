export const auth0Domain = import.meta.env.VITE_AUTH0_DOMAIN?.trim() ?? "";
export const auth0ClientId = import.meta.env.VITE_AUTH0_CLIENT_ID?.trim() ?? "";

// Reject missing/example configuration before constructing the SDK client.
export const auth0Configured =
  /^(?:[a-z\d](?:[a-z\d-]*[a-z\d])?\.)+[a-z]{2,}$/i.test(auth0Domain) &&
  /^[a-z\d_-]+$/i.test(auth0ClientId) &&
  !auth0ClientId.startsWith("your-");

// Root-hosted SPA: also works on a future production origin once allowlisted.
export const auth0ReturnTo = window.location.origin;

export function clearAuth0Callback() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("state") ||
      !(url.searchParams.has("code") || url.searchParams.has("error"))) return;
  for (const key of ["code", "state", "error", "error_description", "error_uri", "iss"]) {
    url.searchParams.delete(key);
  }
  window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
}
