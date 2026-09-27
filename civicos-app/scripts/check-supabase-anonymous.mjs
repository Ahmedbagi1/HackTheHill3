// Read-only check of the actual project's public endpoint. No JWT, password,
// privileged key or submitted data is used or printed.
import { loadEnv } from 'vite';

const env = loadEnv('development', process.cwd(), 'VITE_SUPABASE_');
const url = process.env.VITE_SUPABASE_URL ?? env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key?.startsWith('sb_publishable_')) throw new Error('The public Supabase URL/publishable key is missing.');
for (const [label, path, method] of [
  ['health RPC', '/rest/v1/rpc/civicos_application_health', 'POST'],
  ['applications', '/rest/v1/applications?select=id&limit=0', 'GET'],
  ['history', '/rest/v1/application_events?select=id&limit=0', 'GET'],
]) {
  let response;
  try {
    response = await fetch(new URL(path, url), {
      method, headers: { apikey: key, 'Content-Type': 'application/json' },
      ...(method === 'POST' && { body: '{}' }), signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error(`Network access failed while checking anonymous ${label}.`);
  }
  const body = await response.json();
  if (![401, 403].includes(response.status) || body.code !== '42501') {
    throw new Error(`Anonymous ${label}: unexpected HTTP ${response.status}, code ${String(body.code ?? 'missing')}. Stop and inspect configuration.`);
  }
  console.log(`PASS: live ${label} denies anonymous access (HTTP ${response.status}, 42501).`);
}
console.log('Authenticated live persistence still requires a real verified Auth0 browser session.');
