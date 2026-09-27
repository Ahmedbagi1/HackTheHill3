-- Stage 2: validated, atomic writes for the 29 catalog service forms.
-- Housing/doctor/autism have separate intake contracts; they are not accepted
-- by this API yet. No seed records, government calls, or administrative UI.

alter table public.application_events
  add column operation_key uuid,
  add column operation text,
  add constraint application_events_operation_pair check (
    (operation_key is null and operation is null)
    or (operation_key is not null and operation is not null and operation in (
      'submit', 'start_review', 'request_information', 'respond', 'complete', 'reject', 'withdraw'
    ))
  ),
  add constraint application_events_operation_key unique (application_id, operation_key);

create function civicos_private.validate_service_payload(
  p_definition jsonb, p_payload jsonb, p_as_of date
)
returns jsonb
language plpgsql immutable security invoker
set search_path = ''
as $$
declare
  answers jsonb;
  normalized jsonb := '{}'::jsonb;
  field jsonb;
  field_value jsonb;
  item jsonb;
  name text;
  kind text;
  value_text text;
  amount numeric;
  date_value date;
  digits text;
  digit integer;
  checksum integer;
  i integer;
begin
  if p_definition is null then
    raise exception 'This service is not supported by this version of the application API.' using errcode = '22023';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or octet_length(p_payload::text) > 65536 then
    raise exception 'The application must be an object no larger than 64 KiB.' using errcode = '22023';
  end if;
  if p_payload -> 'consent' is distinct from 'true'::jsonb
     or p_payload -> 'demoAcknowledged' is distinct from 'true'::jsonb then
    raise exception 'Confirm consent and that this is a prototype using test information only.' using errcode = '22023';
  end if;
  if p_payload - array['answers', 'consent', 'demoAcknowledged'] <> '{}'::jsonb
     or jsonb_typeof(p_payload -> 'answers') is distinct from 'object' then
    raise exception 'Unexpected application envelope.' using errcode = '22023';
  end if;
  answers := p_payload -> 'answers';
  if exists (
    select 1 from jsonb_object_keys(answers) k
    where not exists (select 1 from jsonb_array_elements(p_definition -> 'fields') f where f ->> 'name' = k)
  ) then
    raise exception 'The application contains unrecognized fields. Reload the form.' using errcode = '22023';
  end if;

  for field in select * from jsonb_array_elements(p_definition -> 'fields') loop
    name := field ->> 'name';
    kind := field ->> 'type';
    -- Discard stale answers to currently hidden fields rather than persisting
    -- irrelevant personal information. Conditions contain only known choices.
    if exists (
      select 1 from jsonb_array_elements(coalesce(field -> 'conditions', '[]')) c
      where not coalesce((c -> 'values') @> jsonb_build_array(normalized -> (c ->> 'name')), false)
    ) then continue; end if;
    field_value := answers -> name;
    if field_value is null or field_value = 'null'::jsonb or (kind = 'checkbox-group' and field_value = '[]'::jsonb)
       or (jsonb_typeof(field_value) = 'string' and btrim(field_value #>> '{}') = '')
       or (kind = 'checkbox' and field_value = 'false'::jsonb) then
      if (field ->> 'optional')::boolean then continue; end if;
      raise exception '% is required.', field ->> 'label' using errcode = '22023';
    end if;

    begin
      if kind = 'checkbox' then
        if jsonb_typeof(field_value) <> 'boolean' then raise exception using errcode = '22023'; end if;
      elsif kind = 'checkbox-group' then
        if jsonb_typeof(field_value) <> 'array' then raise exception using errcode = '22023'; end if;
        if jsonb_array_length(field_value) > jsonb_array_length(field -> 'options')
           or (select count(distinct v) from jsonb_array_elements(field_value) v) <> jsonb_array_length(field_value)
           or exists (
             select 1 from jsonb_array_elements(field_value) v
             where not exists (select 1 from jsonb_array_elements(field -> 'options') o where o -> 'value' = v)
           ) then raise exception using errcode = '22023'; end if;
      elsif kind in ('geotag', 'waste-lookup') then
        if jsonb_typeof(field_value) <> 'object' or octet_length(field_value::text) > 8192
           or jsonb_typeof(field_value -> 'lat') is distinct from 'number'
           or jsonb_typeof(field_value -> 'lon') is distinct from 'number' then
          raise exception using errcode = '22023';
        end if;
        if abs((field_value ->> 'lat')::numeric) > 90 or abs((field_value ->> 'lon')::numeric) > 180 then
          raise exception using errcode = '22023';
        end if;
        if kind = 'geotag' then
          if field_value - array['lat', 'lon', 'accuracy', 'label'] <> '{}'::jsonb
             or jsonb_typeof(field_value -> 'accuracy') is distinct from 'number'
             or (field_value ->> 'accuracy')::numeric < 0 then raise exception using errcode = '22023'; end if;
          if field_value ? 'label' and field_value -> 'label' <> 'null'::jsonb
             and (jsonb_typeof(field_value -> 'label') <> 'string' or length(field_value ->> 'label') > 1000) then
            raise exception using errcode = '22023';
          end if;
        else
          if field_value - array['lat', 'lon', 'address', 'displayName', 'day', 'zone', 'schedule',
                          'scheduleCode', 'multiResidential', 'contractor', 'nextCollection', 'rotation'] <> '{}'::jsonb
             or jsonb_typeof(field_value -> 'rotation') is distinct from 'array'
             or jsonb_typeof(field_value -> 'multiResidential') is distinct from 'boolean'
             or jsonb_typeof(field_value -> 'address') is distinct from 'string'
             or length(btrim(field_value ->> 'address')) = 0
             or jsonb_typeof(field_value -> 'day') is distinct from 'string'
             or jsonb_typeof(field_value -> 'schedule') is distinct from 'string' then
            raise exception using errcode = '22023';
          end if;
          if jsonb_array_length(field_value -> 'rotation') > 10 then raise exception using errcode = '22023'; end if;
          for item in select * from jsonb_array_elements(field_value -> 'rotation') loop
            if jsonb_typeof(item) <> 'object' or item - array['stream', 'frequency'] <> '{}'::jsonb
               or jsonb_typeof(item -> 'stream') is distinct from 'string'
               or jsonb_typeof(item -> 'frequency') is distinct from 'string'
               or length(item ->> 'stream') > 200 or length(item ->> 'frequency') > 500 then
              raise exception using errcode = '22023';
            end if;
          end loop;
          for name in select unnest(array['address', 'displayName', 'day', 'zone', 'schedule',
                                        'scheduleCode', 'contractor', 'nextCollection']) loop
            if field_value ? name and field_value -> name <> 'null'::jsonb
               and (jsonb_typeof(field_value -> name) <> 'string' or length(field_value ->> name) > 1000) then
              raise exception using errcode = '22023';
            end if;
          end loop;
          name := field ->> 'name';
        end if;
      else
        -- HTML fields supply strings, including numeric inputs. Keep this shape
        -- so a saved form can be reopened and exported by the existing formatter.
        if jsonb_typeof(field_value) <> 'string' then raise exception using errcode = '22023'; end if;
        value_text := btrim(field_value #>> '{}');
        field_value := to_jsonb(value_text);
        if length(value_text) > (field ->> 'maxLength')::integer then raise exception using errcode = '22023'; end if;
        if field ? 'pattern' then
          if coalesce((field ->> 'insensitive')::boolean, false) then
            if value_text !~* (field ->> 'pattern') then raise exception using errcode = '22023'; end if;
          elsif value_text !~ (field ->> 'pattern') then raise exception using errcode = '22023';
          end if;
        end if;
        if kind in ('select', 'radio') and not exists (
          select 1 from jsonb_array_elements(field -> 'options') o where o -> 'value' = field_value
        ) then raise exception using errcode = '22023'; end if;
        if kind = 'number' then
          if value_text !~ '^[+-]?([0-9]+(\.[0-9]*)?|\.[0-9]+)([eE][+-]?[0-9]{1,3})?$' then
            raise exception using errcode = '22023';
          end if;
          amount := value_text::numeric;
          if abs(amount) > 1e12 or amount < (field ->> 'min')::numeric or amount > (field ->> 'max')::numeric
             or ((field ->> 'step')::numeric = 1 and amount <> trunc(amount)) then
            raise exception using errcode = '22023';
          end if;
        elsif kind = 'date' then
          if value_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception using errcode = '22023'; end if;
          date_value := value_text::date;
          if ((field ->> 'notAfterToday')::boolean and date_value > p_as_of)
             or ((field ->> 'notBeforeToday')::boolean and date_value < p_as_of) then
            raise exception using errcode = '22023';
          end if;
        end if;
        case field ->> 'rule'
          when 'sin' then
            digits := regexp_replace(value_text, '[^0-9]', '', 'g');
            if length(digits) <> 9 then raise exception using errcode = '22023'; end if;
            checksum := 0;
            for i in 1..9 loop
              digit := substring(digits, i, 1)::integer;
              if i % 2 = 0 then digit := digit * 2; end if;
              checksum := checksum + case when digit > 9 then digit - 9 else digit end;
            end loop;
            if checksum % 10 <> 0 then raise exception using errcode = '22023'; end if;
          when 'at-least-one-child' then
            if coalesce((normalized ->> 'childrenUnder6')::numeric, 0) + value_text::numeric <= 0 then
              raise exception using errcode = '22023';
            end if;
          when 'adult-voter' then
            if date_value + interval '18 years' > p_as_of then raise exception using errcode = '22023'; end if;
          when 'roll-number' then
            if length(regexp_replace(value_text, '[^0-9]', '', 'g')) <> 19 then raise exception using errcode = '22023'; end if;
          else null;
        end case;
      end if;
    exception
      when data_exception then
        -- Never echo a government identifier, answer, or raw database error.
        raise exception '% has an invalid value.', field ->> 'label' using errcode = '22023';
    end;
    normalized := normalized || jsonb_build_object(name, field_value);
  end loop;
  return jsonb_build_object('answers', normalized, 'consent', true, 'demoAcknowledged', true);
end;
$$;
revoke all on function civicos_private.validate_service_payload(jsonb, jsonb, date) from public, anon, authenticated;

create function public.submit_application(
  p_service_id text, p_payload jsonb, p_idempotency_key uuid, p_schema_version integer default 1
)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  subject text := civicos_private.current_subject();
  issuer text := auth.jwt() ->> 'iss';
  definition jsonb;
  validated jsonb;
  application public.applications%rowtype;
begin
  if subject is null then
    raise exception 'A verified CivicOS session is required.' using errcode = '28000';
  end if;
  if p_idempotency_key is null or p_schema_version is distinct from 1 then
    raise exception 'A request key and supported form version are required.' using errcode = '22023';
  end if;
  -- Serialize retries for the same account/key. No client-provided identity,
  -- title, category, reference, timestamps, or processing status is trusted.
  perform pg_advisory_xact_lock(hashtextextended(issuer || ':' || subject || ':' || p_idempotency_key::text, 0));
  select * into application from public.applications a
    where a.owner_issuer = issuer and a.owner_subject = subject and a.idempotency_key = p_idempotency_key;
  if application.id is not null and application.service_id is distinct from p_service_id then
    raise exception 'This request key was already used for another submission.' using errcode = '23505';
  end if;
  definition := civicos_private.service_definition(p_service_id);
  -- CivicOS's Ottawa services use the local calendar day, including after UTC
  -- midnight. Retries validate against the original submission day.
  validated := civicos_private.validate_service_payload(
    definition, p_payload, coalesce((application.submitted_at at time zone 'America/Toronto')::date,
                                  (now() at time zone 'America/Toronto')::date)
  );
  if application.id is not null then
    if application.submitted_payload is distinct from validated then
      raise exception 'This request key was already used for different answers.' using errcode = '23505';
    end if;
    return to_jsonb(application);
  end if;

  insert into public.applications (
    owner_issuer, owner_subject, idempotency_key, service_id, module, title, category,
    schema_version, submitted_payload, payload, summary
  ) values (
    issuer, subject, p_idempotency_key, p_service_id, 'service', definition ->> 'title', definition ->> 'category',
    p_schema_version, validated, validated, jsonb_build_array(
      jsonb_build_object('label', 'Service', 'value', definition ->> 'title'),
      jsonb_build_object('label', 'Processing', 'value', 'CivicOS prototype only')
    )
  ) returning * into application;
  insert into public.application_events (
    application_id, application_revision, to_status, source, actor_subject, note, operation_key, operation
  ) values (
    application.id, 1, 'submitted', 'submission', subject,
    'Saved in CivicOS. Prototype only; nothing was sent to a government service.', p_idempotency_key, 'submit'
  );
  return to_jsonb(application);
end;
$$;
revoke all on function public.submit_application(text, jsonb, uuid, integer) from public, anon, authenticated;
grant execute on function public.submit_application(text, jsonb, uuid, integer) to authenticated;

create function public.apply_application_action(
  p_application_id uuid, p_expected_revision integer, p_action text,
  p_operation_key uuid, p_note text default null
)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  subject text := civicos_private.current_subject();
  issuer text := auth.jwt() ->> 'iss';
  application public.applications%rowtype;
  previous_event public.application_events%rowtype;
  next_status text;
  event_source text;
  event_note text;
  previous_status text;
begin
  if subject is null then raise exception 'A verified CivicOS session is required.' using errcode = '28000'; end if;
  if p_application_id is null or p_operation_key is null or p_expected_revision is null or p_expected_revision < 1
     or p_action is null or p_action not in ('start_review', 'request_information', 'respond', 'complete', 'reject', 'withdraw') then
    raise exception 'Invalid application action.' using errcode = '22023';
  end if;
  if p_action = 'respond' then
    event_note := btrim(p_note);
    if event_note is null or length(event_note) not between 1 and 2000 then
      raise exception 'Enter additional test information, up to 2,000 characters.' using errcode = '22023';
    end if;
  elsif p_note is not null then
    raise exception 'Only an information response accepts a note.' using errcode = '22023';
  end if;

  -- SECURITY DEFINER bypasses table RLS, so check BOTH ownership components
  -- explicitly before locking or returning any private row.
  select * into application from public.applications a
    where a.id = p_application_id and a.owner_issuer = issuer and a.owner_subject = subject
    for update;
  if not found then raise exception 'Application not found.' using errcode = 'P0002'; end if;
  if application.module <> 'service' or application.processing_mode <> 'demo' then
    raise exception 'This application does not support prototype processing.' using errcode = '22023';
  end if;
  select * into previous_event from public.application_events e
    where e.application_id = application.id and e.operation_key = p_operation_key;
  if found then
    if previous_event.operation is distinct from p_action
       or previous_event.application_revision <> p_expected_revision + 1
       or (p_action = 'respond' and previous_event.note is distinct from event_note) then
      raise exception 'This action key was already used for a different operation.' using errcode = '23505';
    end if;
    return to_jsonb(application);
  end if;
  if application.revision <> p_expected_revision then
    raise exception 'This application changed. Refresh it before trying again.' using errcode = '40001';
  end if;

  case
    when p_action = 'start_review' and application.status = 'submitted' then
      next_status := 'under_review'; event_source := 'demo_processing';
      event_note := 'Prototype review started in CivicOS.';
    when p_action = 'request_information' and application.status = 'under_review' then
      next_status := 'needs_information'; event_source := 'demo_processing';
      event_note := 'Prototype review requests additional test information. Use the response field; do not provide real identifiers.';
    when p_action = 'respond' and application.status = 'needs_information' then
      next_status := 'under_review'; event_source := 'user_response';
    when p_action = 'complete' and application.status = 'under_review' then
      next_status := 'completed'; event_source := 'demo_processing';
      event_note := 'Prototype processing completed in CivicOS. This is not government approval.';
    when p_action = 'reject' and application.status = 'under_review' then
      next_status := 'rejected'; event_source := 'demo_processing';
      event_note := 'Prototype rejection recorded in CivicOS. This is not a government decision.';
    when p_action = 'withdraw' and application.status in ('submitted', 'under_review', 'needs_information') then
      next_status := 'withdrawn'; event_source := 'withdrawal';
      event_note := 'Withdrawn by the applicant in CivicOS. The saved record and history remain available.';
    else raise exception 'This action is not allowed for the current status.' using errcode = '22023';
  end case;
  previous_status := application.status;
  update public.applications set status = next_status, revision = revision + 1, updated_at = clock_timestamp()
    where id = application.id returning * into application;
  insert into public.application_events (
    application_id, application_revision, from_status, to_status, source, actor_subject, note, operation_key, operation
  ) values (
    application.id, application.revision, previous_status, next_status, event_source, subject, event_note, p_operation_key, p_action
  );
  return to_jsonb(application);
end;
$$;
revoke all on function public.apply_application_action(uuid, integer, text, uuid, text) from public, anon, authenticated;
grant execute on function public.apply_application_action(uuid, integer, text, uuid, text) to authenticated;

create or replace function public.civicos_application_health()
returns jsonb
language plpgsql stable security invoker
set search_path = ''
as $$
begin
  if civicos_private.current_subject() is null then
    raise exception 'CivicOS identity configuration or verified session is missing.' using errcode = '28000';
  end if;
  return jsonb_build_object('schema_version', 2, 'write_api_ready', true, 'supported_modules', jsonb_build_array('service'));
end;
$$;
revoke all on function public.civicos_application_health() from public, anon, authenticated;
grant execute on function public.civicos_application_health() to authenticated;
