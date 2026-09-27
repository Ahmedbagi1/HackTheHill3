import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { DEFINITION_MIGRATIONS, latestDefinitionSql, readServiceDefinitions } from './service-definitions.mjs';

export async function buildApplicationApiSql() {
  const definitions = await readServiceDefinitions();
  const [catalog, ...revisions] = await Promise.all(DEFINITION_MIGRATIONS.map((name) =>
    readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8')));
  if ((revisions.at(-1) ?? catalog) !== latestDefinitionSql(definitions)) {
    throw new Error('The service forms differ from the reviewed SQL schema. Prepare a new migration; do not overwrite an applied migration.');
  }
  const api = await readFile(new URL('../supabase/migrations/202609260003_application_api.sql', import.meta.url), 'utf8');
  return `-- CivicOS stage 2. Run this ENTIRE file ONCE in Supabase SQL Editor.
-- Requires the previously applied setup.local.sql. Do not rerun that foundation.
-- No credentials, submitted data, resets, or changes to Auth0 configuration.
begin;

-- Fail before any DDL if stage 1 is missing or its policies/configuration changed.
do $preflight$
begin
  if not exists (select 1 from civicos_private.auth_configuration where singleton)
     or not (select relrowsecurity from pg_class where oid = 'public.applications'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.application_events'::regclass)
     or not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'applications' and policyname = 'applications_owner_read')
     or not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'application_events' and policyname = 'application_events_owner_read') then
    raise exception 'The CivicOS foundation is missing or was changed. Stop and report this error.';
  end if;
end;
$preflight$;

${catalog}
${api}
${revisions.join('\n')}

commit;
notify pgrst, 'reload schema';

-- Expected: every boolean is true; supported_service_count is 29.
-- Authenticated health is tested later in the browser, not by inventing a JWT here.
select
  (select relrowsecurity from pg_class where oid = 'public.applications'::regclass) as applications_rls,
  (select relrowsecurity from pg_class where oid = 'public.application_events'::regclass) as history_rls,
  exists (select 1 from civicos_private.auth_configuration where singleton) as auth0_configured,
  to_regprocedure('public.submit_application(text,jsonb,uuid,integer)') is not null as submit_rpc_ready,
  to_regprocedure('public.apply_application_action(uuid,integer,text,uuid,text)') is not null as lifecycle_rpc_ready,
  (select count(*) from unnest(array[${definitions.map(({ id }) => `'${id}'`).join(', ')}]) as service_id
    where civicos_private.service_definition(service_id) is not null) as supported_service_count,
  not has_table_privilege('authenticated', 'public.applications', 'INSERT,UPDATE,DELETE')
    and not has_table_privilege('authenticated', 'public.application_events', 'INSERT,UPDATE,DELETE') as direct_writes_blocked;
`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await writeFile(new URL('../supabase/application-api.local.sql', import.meta.url), await buildApplicationApiSql(), { mode: 0o600 });
  console.log('Prepared supabase/application-api.local.sql (29 services). No cloud changes made.');
  console.log('Review the script and follow the stage 2 checkpoint in docs/PERSISTENCE.md.');
}
