import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import {
  createApplicationRepository, PersistenceError,
  type ApplicationAction, type ApplicationPayload, type ApplicationRepository, type SavedApplication,
} from '../services/applicationRepository';

export function useServiceApplications(subject: string | null) {
  const { getAccessTokenSilently, getIdTokenClaims } = useAuth0();
  const repo = useRef<ApplicationRepository | null>(null);
  const generation = useRef(0);
  const [rows, setRows] = useState<SavedApplication[]>([]);
  const [status, setStatus] = useState<'signed_out' | 'loading' | 'ready' | 'error'>(subject ? 'loading' : 'signed_out');
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const page = useRef(0);
  const listVersion = useRef(0);
  const listBusy = useRef(false);

  const requireRepository = useCallback(() => {
    if (!repo.current) throw new PersistenceError('AUTH_REQUIRED', 'Sign in with a verified account to save or view applications.');
    return repo.current;
  }, []);
  const load = useCallback(async (more = false) => {
    if (more && listBusy.current) return;
    const version = ++listVersion.current;
    const currentGeneration = generation.current;
    listBusy.current = true;
    setStatus('loading'); setError(null);
    try {
      const result = await requireRepository().list(more ? page.current + 1 : 0);
      if (version !== listVersion.current || currentGeneration !== generation.current) return;
      page.current = more ? page.current + 1 : 0;
      setRows((previous) => more
        ? [...new Map([...previous, ...result.applications].map((row) => [row.id, row])).values()]
        : result.applications);
      setHasMore(result.hasMore); setStatus('ready');
    } catch (cause) {
      if (version !== listVersion.current || currentGeneration !== generation.current) return;
      setError(cause instanceof PersistenceError ? cause.message : 'Could not load saved applications. Please retry.');
      setStatus('error');
    } finally {
      if (version === listVersion.current && currentGeneration === generation.current) listBusy.current = false;
    }
  }, [requireRepository]);

  const invalidateSession = useCallback(() => {
    generation.current++; listVersion.current++; repo.current = null;
  }, []);
  useEffect(() => {
    const currentGeneration = ++generation.current;
    if (!subject) return;
    let cancelled = false;
    let instance: ApplicationRepository | null = null;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        instance = createApplicationRepository({
          subject, isCurrentSession: () => generation.current === currentGeneration,
          refreshSession: getAccessTokenSilently, getIdTokenClaims,
        });
        repo.current = instance;
        void load();
      } catch (cause) {
        setError(cause instanceof PersistenceError ? cause.message : 'Application storage could not be configured.');
        setStatus('error');
      }
    });
    return () => {
      cancelled = true; instance?.dispose(); invalidateSession();
    };
  }, [subject, getAccessTokenSilently, getIdTokenClaims, load, invalidateSession]);

  const remember = useCallback((row: SavedApplication) => {
    // A list request started before a write must not replace its newer result.
    listVersion.current++; listBusy.current = false;
    setRows((previous) => [row, ...previous.filter((item) => item.id !== row.id)]
      .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at) || b.id.localeCompare(a.id)));
    setStatus('ready'); setError(null);
    return row;
  }, []);
  const submit = useCallback(async (input: { serviceId: string; payload: ApplicationPayload; requestKey: string }) => {
    const saved = remember(await requireRepository().submit(input.serviceId, input.payload, input.requestKey));
    // Reconcile the first page even if the initial list failed before this save.
    void load();
    return saved;
  }, [remember, requireRepository, load]);
  const act = useCallback(async (id: string, revision: number, action: ApplicationAction, key: string, note: string | null = null) =>
    remember(await requireRepository().act(id, revision, action, key, note)), [remember, requireRepository]);
  const get = useCallback((id: string) => requireRepository().get(id), [requireRepository]);
  const history = useCallback((id: string, historyPage = 0) => requireRepository().history(id, historyPage), [requireRepository]);
  const refresh = useCallback(() => load(false), [load]);
  const loadMore = useCallback(() => load(true), [load]);
  return { rows, status, error, hasMore, refresh, loadMore, submit, act, get, history, remember };
}

export type ServicePersistence = ReturnType<typeof useServiceApplications>;
