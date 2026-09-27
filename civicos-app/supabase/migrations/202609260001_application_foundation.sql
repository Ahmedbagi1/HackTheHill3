-- CivicOS application persistence, stage 1. Apply through db:prepare's bundle.
-- No application records are inserted. Existing objects are never replaced.
-- Browser writes remain disabled until the validated submission RPC migration.
-- Supabase's API verifies Auth0 JWT signatures/expiry before auth.jwt() is used.

create schema civicos_private;
revoke all on schema civicos_private from public, anon, authenticated;
grant usage on schema civicos_private to authenticated;

-- Deployment configuration, not a second user database. Never expose this schema
-- in Supabase's Data API. The setup bundle fills it using public Auth0 identifiers.
create table civicos_private.auth_configuration (
  singleton boolean primary key default true check (singleton),
  issuer text not null check (issuer ~ '^https://[a-zA-Z0-9.-]+/$'),
  client_id text not null check (client_id ~ '^[a-zA-Z0-9_-]+$')
);
revoke all on table civicos_private.auth_configuration from public, anon, authenticated;
alter table civicos_private.auth_configuration enable row level security;

create function civicos_private.current_subject()
returns text
language plpgsql stable security definer
set search_path = ''
as $$
declare
  claims jsonb := auth.jwt();
  configuration civicos_private.auth_configuration%rowtype;
begin
  select * into configuration from civicos_private.auth_configuration where singleton;
  if not found then return null; end if;

  -- Auth0 subjects are strings such as auth0|..., not Supabase UUIDs.
  -- Restrict this API to our tenant AND SPA, even if a tenant hosts other apps.
  if claims ->> 'iss' = configuration.issuer
     and (
       claims -> 'aud' = to_jsonb(configuration.client_id)
       or (jsonb_typeof(claims -> 'aud') = 'array'
           and claims -> 'aud' @> jsonb_build_array(configuration.client_id))
     )
     and claims ->> 'role' = 'authenticated'
     and claims -> 'email_verified' = 'true'::jsonb
     and jsonb_typeof(claims -> 'sub') = 'string'
     and length(btrim(claims ->> 'sub')) between 1 and 255
  then
    return claims ->> 'sub';
  end if;
  return null;
end;
$$;
revoke all on function civicos_private.current_subject() from public, anon, authenticated;
grant execute on function civicos_private.current_subject() to authenticated;

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  reference_id text not null unique
    default ('CIV-' || upper(replace(gen_random_uuid()::text, '-', ''))),
  owner_issuer text not null,
  owner_subject text not null check (length(btrim(owner_subject)) between 1 and 255),
  idempotency_key uuid not null,
  service_id text not null check (service_id in (
    'passport', 'sin', 'employment-insurance', 'cpp-oas', 'income-tax',
    'canada-child-benefit', 'gst-hst-credit', 'immigration-pr', 'voter-registration',
    'veterans-benefits', 'dental-care', 'drivers-licence', 'vehicle-registration',
    'ohip', 'vital-statistics', 'odsp', 'ontario-works', 'osap',
    'landlord-tenant-board', 'business-registration', 'waste-collection',
    'property-tax-water', 'parking', 'building-permits', 'pet-licensing',
    'transit-discounts', 'recreation', 'police-report', 'service-requests-311',
    'housing', 'doctor', 'autism'
  )),
  module text not null check (module in ('service', 'housing', 'doctor', 'autism')),
  title text not null check (length(btrim(title)) between 1 and 200),
  category text not null check (category in (
    'housing', 'health', 'family', 'utilities', 'transportation', 'money',
    'identity', 'work', 'community'
  )),
  status text not null default 'submitted' check (status in (
    'submitted', 'under_review', 'needs_information', 'completed', 'rejected', 'withdrawn'
  )),
  schema_version integer not null default 1 check (schema_version = 1),
  revision integer not null default 1 check (revision > 0),
  -- Both snapshots contain only demo input. Future RPCs validate each service's
  -- fields; these checks are the baseline envelope/size constraints, not that API.
  submitted_payload jsonb not null check (
    jsonb_typeof(submitted_payload) = 'object' and octet_length(submitted_payload::text) <= 65536
  ),
  payload jsonb not null check (
    jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 65536
  ),
  summary jsonb not null default '[]'::jsonb check (
    jsonb_typeof(summary) = 'array' and jsonb_array_length(summary) <= 8
    and octet_length(summary::text) <= 8192
  ),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processing_mode text not null default 'demo' check (processing_mode = 'demo'),
  constraint applications_idempotency unique (owner_issuer, owner_subject, idempotency_key),
  constraint applications_module_service check (
    (module = 'service' and service_id not in ('housing', 'doctor', 'autism'))
    or (module <> 'service' and service_id = module)
  ),
  constraint applications_timestamps check (updated_at >= submitted_at)
);
create index applications_owner_submitted_idx
  on public.applications (owner_issuer, owner_subject, submitted_at desc, id desc);

create table public.application_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete restrict,
  application_revision integer not null check (application_revision > 0),
  from_status text check (from_status in (
    'submitted', 'under_review', 'needs_information', 'completed', 'rejected', 'withdrawn'
  )),
  to_status text not null check (to_status in (
    'submitted', 'under_review', 'needs_information', 'completed', 'rejected', 'withdrawn'
  )),
  source text not null check (source in (
    'submission', 'demo_processing', 'user_response', 'withdrawal', 'module_update'
  )),
  actor_subject text not null check (length(btrim(actor_subject)) between 1 and 255),
  note text check (length(note) <= 2000),
  created_at timestamptz not null default now(),
  constraint application_events_revision unique (application_id, application_revision)
);

-- Revoke Supabase's possible default grants explicitly, including PUBLIC.
-- This stage intentionally has no browser INSERT/UPDATE/DELETE path.
revoke all on table public.applications, public.application_events from public, anon, authenticated;
grant select on table public.applications, public.application_events to authenticated;
alter table public.applications enable row level security;
alter table public.application_events enable row level security;

create policy applications_owner_read on public.applications
for select to authenticated
using (
  owner_subject = (select civicos_private.current_subject())
  and owner_issuer = (select auth.jwt() ->> 'iss')
);

create policy application_events_owner_read on public.application_events
for select to authenticated
using (
  exists (
    select 1 from public.applications a
    where a.id = application_events.application_id
      and a.owner_subject = (select civicos_private.current_subject())
      and a.owner_issuer = (select auth.jwt() ->> 'iss')
  )
);

-- A real signed-in client can distinguish a configured database from an empty
-- list. It reveals no account data and cannot mutate any records.
create function public.civicos_application_health()
returns jsonb
language plpgsql stable security invoker
set search_path = ''
as $$
begin
  if civicos_private.current_subject() is null then
    raise exception 'CivicOS identity configuration or verified session is missing.'
      using errcode = '28000';
  end if;
  return jsonb_build_object('schema_version', 1, 'write_api_ready', false);
end;
$$;
revoke all on function public.civicos_application_health() from public, anon, authenticated;
grant execute on function public.civicos_application_health() to authenticated;
