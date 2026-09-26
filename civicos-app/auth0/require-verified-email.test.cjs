const assert = require("node:assert/strict");
const { test } = require("node:test");
const { onExecutePostLogin } = require("./require-verified-email.cjs");

// Isolated Action policy tests, never used as application authentication.
async function denialsFor(user, metadata, protocol = "oidc-basic-profile") {
  const denials = [];
  await onExecutePostLogin(
    { user, client: { metadata }, transaction: { protocol } },
    { access: { deny: (reason) => denials.push(reason) } },
  );
  return denials;
}

const enabled = { civicos_require_verified_email: "true" };

test("requires an explicitly verified email for CivicOS", async () => {
  for (const email_verified of [false, undefined, null, "true", 1]) {
    const denials = await denialsFor({ email: "policy-test@example.invalid", email_verified }, enabled);
    assert.equal(denials.length, 1);
    assert.match(denials[0], /^CIVICOS_EMAIL_UNVERIFIED:/);
  }
  assert.equal((await denialsFor({ email_verified: true }, enabled)).length, 1);
});

test("allows a verified email", async () => {
  assert.deepEqual(await denialsFor({ email: "policy-test@example.invalid", email_verified: true }, enabled), []);
});

test("also denies unverified refresh-token exchanges", async () => {
  assert.equal((await denialsFor({ email: "policy-test@example.invalid", email_verified: false }, enabled, "oauth2-refresh-token")).length, 1);
});

test("does not change other applications' login policies", async () => {
  for (const metadata of [undefined, {}, { civicos_require_verified_email: "false" }]) {
    assert.deepEqual(await denialsFor({ email_verified: false }, metadata), []);
  }
});
