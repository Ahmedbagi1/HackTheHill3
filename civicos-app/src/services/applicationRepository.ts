import { createClient } from '@supabase/supabase-js';

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type ApplicationStatus = 'submitted' | 'under_review' | 'needs_information' | 'completed' | 'rejected' | 'withdrawn';
export type ApplicationAction = 'start_review' | 'request_information' | 'respond' | 'complete' | 'reject' | 'withdraw';
export interface ApplicationPayload {
  answers: Record<string, Json>;
  consent: boolean;
  demoAcknowledged: boolean;
}
export interface SavedApplication {
  id: string;
  reference_id: string;
  owner_issuer: string;
  owner_subject: string;
  idempotency_key: string;
  service_id: string;
  module: 'service';
  title: string;
  category: string;
  status: ApplicationStatus;
  schema_version: 1;
  revision: number;
  submitted_payload: ApplicationPayload;
  payload: ApplicationPayload;
  summary: { label: string; value: string }[];
  submitted_at: string;
  updated_at: string;
  processing_mode: 'demo';
}
export interface ApplicationEvent {
  id: string;
  application_id: string;
  application_revision: number;
  from_status: ApplicationStatus | null;
  to_status: ApplicationStatus;
  source: 'submission' | 'demo_processing' | 'user_response' | 'withdrawal' | 'module_update';
  actor_subject: string;
  note: string | null;
  created_at: string;
  operation_key: string | null;
  operation: ApplicationAction | 'submit' | null;
}
export interface PersistenceConfig {
  url: string;
  publishableKey: string;
  issuer: string;
  clientId: string;
}
interface IdTokenClaims {
  __raw: string;
  sub?: string;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  email_verified?: boolean;
  role?: string;
}
export interface ApplicationSession {
  subject: string;
  // Bind these to one Auth0 session. Return false on logout/account change, and
  // dispose the repository when that session ends (even for the same subject).
  isCurrentSession: () => boolean;
  refreshSession: () => Promise<unknown>;
  getIdTokenClaims: () => Promise<IdTokenClaims | undefined>;
}

export class PersistenceError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'PersistenceError';
    this.code = code;
  }
}

export function readPersistenceConfig(env: Partial<ImportMetaEnv> = import.meta.env ?? {}): PersistenceConfig {
  const url = env.VITE_SUPABASE_URL?.trim() ?? '';
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';
  const domain = env.VITE_AUTH0_DOMAIN?.trim() ?? '';
  const clientId = env.VITE_AUTH0_CLIENT_ID?.trim() ?? '';
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new PersistenceError('CONFIGURATION', 'Application storage is not configured: check VITE_SUPABASE_URL.'); }
  if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/'
      || (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname)))
      || parsed.hostname.startsWith('your-') || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey)) {
    throw new PersistenceError('CONFIGURATION', 'Application storage needs a valid Supabase URL and public publishable key.');
  }
  if (!/^(?:[a-z\d](?:[a-z\d-]*[a-z\d])?\.)+[a-z]{2,}$/i.test(domain)
      || domain.startsWith('your-') || !/^[a-z\d_-]+$/i.test(clientId) || clientId.startsWith('your-')) {
    throw new PersistenceError('CONFIGURATION', 'Check VITE_AUTH0_DOMAIN and VITE_AUTH0_CLIENT_ID.');
  }
  return { url: parsed.origin, publishableKey, issuer: `https://${domain}/`, clientId };
}

const statuses: readonly string[] = ['submitted', 'under_review', 'needs_information', 'completed', 'rejected', 'withdrawn'];
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value);
const timestamp = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value));
const validPayload = (value: unknown) => object(value) && object(value.answers) && value.consent === true && value.demoAcknowledged === true;
const invalidResponse = () => new PersistenceError('INVALID_RESPONSE', 'Application storage returned an unexpected response. Please report this error.');

function databaseError(error: { code?: string }): PersistenceError {
  const code = error.code ?? '';
  if (['AUTH_REQUIRED', '28000', '42501', 'PGRST301', 'PGRST302', 'PGRST303'].includes(code)) {
    return new PersistenceError('AUTH_REQUIRED', 'Your verified Auth0 session could not access application storage. Sign in again; if this continues, report the configuration error.');
  }
  if (['PGRST202', 'PGRST205', '42883', '42P01'].includes(code)) {
    return new PersistenceError('MIGRATION_REQUIRED', 'The application database setup is incomplete. The required migration must be applied before continuing.');
  }
  if (code === '40001') return new PersistenceError('CONFLICT', 'This application changed. Refresh it before trying again.');
  if (code === '23505') return new PersistenceError('CONFLICT', 'This request key was already used. Refresh your saved applications before submitting changed answers.');
  if (code === 'P0002') return new PersistenceError('NOT_FOUND', 'This application is not available to your account.');
  if (code === '22023') return new PersistenceError('VALIDATION', 'The database rejected the form or action. Review the inputs and refresh if the form has changed.');
  // Raw PostgREST errors can include submitted values or request details. Do not
  // display/log them, and never turn a failure into a successful local save.
  return new PersistenceError('STORAGE_UNAVAILABLE', 'Application storage could not confirm the operation. Check your connection and retry with the same request key.');
}

/** Auth0 is the only login system. Supabase verifies its signed ID token and SQL
 * enforces issuer/subject ownership. There is no browser application cache. */
export function createApplicationRepository(
  session: ApplicationSession,
  config = readPersistenceConfig(),
  transport: typeof fetch = fetch,
) {
  const lifetime = new AbortController();
  let active = true;
  function assertSession() {
    if (!active || !session.subject || !session.isCurrentSession()) {
      throw new PersistenceError('SESSION_CHANGED', 'Your session changed. Sign in before accessing applications.');
    }
  }
  async function token() {
    assertSession();
    try {
      // Let Auth0 renew its own session, then use the ID token carrying the role
      // claim. A userinfo access token is not a replacement for this ID token.
      await session.refreshSession();
      assertSession();
      const claims = await session.getIdTokenClaims();
      assertSession();
      if (!claims?.__raw || claims.sub !== session.subject || claims.iss !== config.issuer
          || !(Array.isArray(claims.aud) ? claims.aud.includes(config.clientId) : claims.aud === config.clientId)
          || claims.role !== 'authenticated' || claims.email_verified !== true
          || !claims.exp || claims.exp * 1000 <= Date.now()) {
        throw new PersistenceError('AUTH_REQUIRED', 'A current verified CivicOS ID token is required. Sign in again.');
      }
      return claims.__raw;
    } catch (error) {
      assertSession();
      if (error instanceof PersistenceError) throw error;
      throw new PersistenceError('AUTH_REQUIRED', 'Auth0 could not renew your session. Sign in again.');
    }
  }
  const client = createClient(config.url, config.publishableKey, {
    accessToken: token,
    db: { timeout: 20000, retry: false },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input, init) => {
      assertSession();
      const response = await transport(input, { ...init, cache: 'no-store' });
      assertSession();
      return response;
    } },
  });

  async function execute<T>(query: { throwOnError: () => PromiseLike<{ data: T | null; error: { code?: string } | null }> }): Promise<T> {
    assertSession();
    try {
      // Preserve Auth0 errors: the SDK's default catch converts callback errors
      // into generic network results, losing the reason login is required.
      const result = await query.throwOnError();
      assertSession();
      if (result.error) throw databaseError(result.error);
      if (result.data === null) throw invalidResponse();
      return result.data;
    } catch (error) {
      assertSession();
      if (error instanceof PersistenceError) throw error;
      throw databaseError(object(error) && typeof error.code === 'string' ? { code: error.code } : {});
    }
  }

  function application(value: unknown): SavedApplication {
    if (!object(value) || !uuid(value.id) || !uuid(value.idempotency_key)
        || typeof value.reference_id !== 'string' || !/^CIV-[0-9A-F]{32}$/.test(value.reference_id)
        || value.owner_subject !== session.subject || value.owner_issuer !== config.issuer
        || value.module !== 'service' || value.processing_mode !== 'demo' || value.schema_version !== 1
        || !statuses.includes(String(value.status)) || !Number.isInteger(value.revision) || Number(value.revision) < 1
        || !timestamp(value.submitted_at) || !timestamp(value.updated_at)
        || typeof value.service_id !== 'string' || typeof value.title !== 'string' || typeof value.category !== 'string'
        || !validPayload(value.payload) || !validPayload(value.submitted_payload)
        || !Array.isArray(value.summary) || !value.summary.every((row) => object(row) && typeof row.label === 'string' && typeof row.value === 'string')) {
      throw invalidResponse();
    }
    return value as unknown as SavedApplication;
  }

  async function checkReady() {
    const health: unknown = await execute(client.rpc('civicos_application_health').abortSignal(lifetime.signal));
    if (!object(health) || health.schema_version !== 2 || health.write_api_ready !== true
        || !Array.isArray(health.supported_modules) || !health.supported_modules.includes('service')) {
      throw new PersistenceError('MIGRATION_REQUIRED', 'The application submission migration is missing or incompatible. Complete database setup before continuing.');
    }
  }
  function pageRange(page: number, size: number) {
    if (!Number.isSafeInteger(page) || page < 0 || page > 1_000_000) throw new PersistenceError('VALIDATION', 'Invalid application page.');
    return [page * size, (page + 1) * size - 1] as const;
  }
  function requireKey(key: string) {
    if (!uuid(key)) throw new PersistenceError('VALIDATION', 'A valid application/request ID is required.');
  }

  return {
    checkReady,
    dispose() { active = false; lifetime.abort(); },
    async list(page = 0): Promise<{ applications: SavedApplication[]; hasMore: boolean }> {
      const [from, to] = pageRange(page, 20);
      await checkReady();
      const data: unknown = await execute(client.from('applications').select('*')
        .eq('module', 'service').order('submitted_at', { ascending: false }).order('id', { ascending: false })
        .range(from, to + 1).abortSignal(lifetime.signal));
      if (!Array.isArray(data)) throw invalidResponse();
      return { applications: data.slice(0, 20).map(application), hasMore: data.length > 20 };
    },
    async get(id: string): Promise<SavedApplication | null> {
      requireKey(id);
      await checkReady();
      const data: unknown = await execute(client.from('applications').select('*').eq('module', 'service').eq('id', id).limit(1).abortSignal(lifetime.signal));
      if (!Array.isArray(data)) throw invalidResponse();
      return data.length ? application(data[0]) : null;
    },
    async history(id: string, page = 0): Promise<{ events: ApplicationEvent[]; hasMore: boolean }> {
      requireKey(id);
      const [from, to] = pageRange(page, 100);
      await checkReady();
      const data: unknown = await execute(client.from('application_events').select('*').eq('application_id', id)
        .order('application_revision', { ascending: true }).range(from, to + 1).abortSignal(lifetime.signal));
      if (!Array.isArray(data)) throw invalidResponse();
      const events = data.slice(0, 100).map((event) => {
        if (!object(event) || !uuid(event.id) || event.application_id !== id || event.actor_subject !== session.subject
            || !statuses.includes(String(event.to_status)) || !(event.from_status === null || statuses.includes(String(event.from_status)))
            || !Number.isInteger(event.application_revision) || Number(event.application_revision) < 1
            || !timestamp(event.created_at) || !(event.note === null || typeof event.note === 'string')
            || !['submission', 'demo_processing', 'user_response', 'withdrawal', 'module_update'].includes(String(event.source))) throw invalidResponse();
        return event as unknown as ApplicationEvent;
      });
      return { events, hasMore: data.length > 100 };
    },
    async submit(serviceId: string, payload: ApplicationPayload, requestKey: string): Promise<SavedApplication> {
      requireKey(requestKey);
      await checkReady();
      return application(await execute(client.rpc('submit_application', {
        p_service_id: serviceId, p_payload: payload, p_idempotency_key: requestKey, p_schema_version: 1,
      }).abortSignal(lifetime.signal)));
    },
    async act(id: string, revision: number, action: ApplicationAction, operationKey: string, note: string | null = null): Promise<SavedApplication> {
      requireKey(id); requireKey(operationKey);
      await checkReady();
      return application(await execute(client.rpc('apply_application_action', {
        p_application_id: id, p_expected_revision: revision, p_action: action, p_operation_key: operationKey, p_note: note,
      }).abortSignal(lifetime.signal)));
    },
  };
}

export type ApplicationRepository = ReturnType<typeof createApplicationRepository>;
