import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, X } from 'lucide-react';
import { useDialogBehavior } from '../../hooks/useDialogBehavior';
import { useCivicData } from '../../state/civicDataStore';
import { APPLICATION_STATUS_LABELS } from '../../state/savedApplicationView';
import { SERVICES_BY_ID, buildSteps } from '../../data/servicesData';
import ReviewSummary from '../../components/wizard/ReviewSummary';
import { downloadReviewPacket } from '../../lib/reviewPacket';
import { PersistenceError, type SavedApplication, type ApplicationEvent, type ApplicationAction } from '../../services/applicationRepository';

type PendingAction = { action: ApplicationAction; key: string; revision: number; note: string | null };
const ACTIONS: { action: ApplicationAction; label: string; status: string[] }[] = [
  { action: 'start_review', label: 'Start prototype review', status: ['submitted'] },
  { action: 'request_information', label: 'Request test information', status: ['under_review'] },
  { action: 'complete', label: 'Complete prototype review', status: ['under_review'] },
  { action: 'reject', label: 'Reject in prototype', status: ['under_review'] },
  { action: 'respond', label: 'Send test information', status: ['needs_information'] },
  { action: 'withdraw', label: 'Withdraw application', status: ['submitted', 'under_review', 'needs_information'] },
];

export default function SavedApplicationDetails({ id, onClose }: { id: string; onClose: () => void }) {
  const { servicePersistence: { get, history, act, remember } } = useCivicData();
  const [application, setApplication] = useState<SavedApplication | null>(null);
  const [events, setEvents] = useState<ApplicationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [pending, setPending] = useState<PendingAction | null>(null);
  const pendingRef = useRef<PendingAction | null>(null);
  const busyRef = useRef(false);
  const sequence = useRef(0);
  useDialogBehavior(onClose);

  const reload = useCallback(async () => {
    const version = ++sequence.current;
    setLoading(true); setError(null);
    try {
      const saved = await get(id);
      if (!saved) throw new PersistenceError('NOT_FOUND', 'This application is not available to your account.');
      const allEvents: ApplicationEvent[] = [];
      let page = 0;
      let more = true;
      while (more) {
        const result = await history(id, page++);
        if (version !== sequence.current) return;
        allEvents.push(...result.events.filter((event) => event.application_revision <= saved.revision));
        more = result.hasMore && (result.events.at(-1)?.application_revision ?? 0) < saved.revision;
      }
      if (version !== sequence.current) return;
      if (allEvents.length !== saved.revision) throw new PersistenceError('INVALID_RESPONSE', 'The saved history is incomplete. Please refresh or report this error.');
      setApplication(saved); setEvents(allEvents); remember(saved);
    } catch (cause) {
      if (version !== sequence.current) return;
      setApplication(null); setEvents([]);
      setError(cause instanceof PersistenceError ? cause.message : 'Could not read the saved application. Please retry.');
    } finally { if (version === sequence.current) setLoading(false); }
  }, [get, history, id, remember]);
  const cancelRead = useCallback(() => { sequence.current++; }, []);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) void reload(); });
    return () => { cancelled = true; cancelRead(); };
  }, [reload, cancelRead]);

  const changeStatus = async (action: ApplicationAction) => {
    if (!application || busyRef.current) return;
    const operation = pendingRef.current ?? { action, key: crypto.randomUUID(), revision: application.revision, note: action === 'respond' ? note.trim() : null };
    if (operation.action === 'withdraw' && !pendingRef.current && !window.confirm('Withdraw this CivicOS application? Its record and history will remain saved.')) return;
    pendingRef.current = operation; setPending(operation);
    busyRef.current = true; setBusy(true); setError(null);
    try {
      const saved = await act(id, operation.revision, operation.action, operation.key, operation.note);
      setApplication(saved); setNote(''); pendingRef.current = null; setPending(null);
      await reload();
    } catch (cause) {
      setError(cause instanceof PersistenceError ? cause.message : 'The status change could not be confirmed. Retry the same action.');
      if (cause instanceof PersistenceError && ['VALIDATION', 'CONFLICT', 'NOT_FOUND'].includes(cause.code)) {
        pendingRef.current = null; setPending(null);
      }
    } finally { busyRef.current = false; setBusy(false); }
  };
  const service = application ? SERVICES_BY_ID[application.service_id] : null;
  const steps = service ? buildSteps(service.form) : [];
  const formData = application ? { ...application.payload.answers, consent: true } : {};

  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="saved-application-title" aria-busy={loading || busy}>
      <div className="modal__header">
        <div><p className="modal__eyebrow">Saved in CivicOS · Prototype</p><h2 className="modal__title" id="saved-application-title">{application?.title ?? 'Saved application'}</h2></div>
        <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><X size={20} /></button>
      </div>
      <div className="modal__body">
        {loading && <p role="status">Loading saved application and history…</p>}
        {error && <p className="field__error" role="alert">{error}</p>}
        {!loading && <button type="button" className="link-btn" disabled={busy} onClick={() => void reload()}>Refresh saved details</button>}
        {application && !loading && <>
          <dl className="review-list">
            <div><dt>Reference</dt><dd className="mono">{application.reference_id}</dd></div>
            <div><dt>Status</dt><dd>{APPLICATION_STATUS_LABELS[application.status]}</dd></div>
            <div><dt>Submitted</dt><dd>{new Date(application.submitted_at).toLocaleString()}</dd></div>
          </dl>
          <p className="callout">This is internal CivicOS prototype processing. Nothing is submitted to government systems. Use test information only.</p>
          <h3 className="form-section-title">Status history</h3>
          <ol className="timeline">{events.map((event) => <li className="timeline__item timeline__item--done" key={event.id}>
            <span className="timeline__dot" aria-hidden="true" />
            <div><p className="timeline__label">{APPLICATION_STATUS_LABELS[event.to_status]}</p>
              <p className="timeline__meta">{new Date(event.created_at).toLocaleString()}</p><p>{event.note}</p></div>
          </li>)}</ol>
          <h3 className="form-section-title">Prototype processing controls</h3>
          <p className="fineprint">Try the lifecycle of your own saved application. These controls do not represent a government reviewer.</p>
          {application.status === 'needs_information' && <label className="field">Additional test information
            <textarea className="input" maxLength={2000} value={note} disabled={busy || Boolean(pending)} onChange={(e) => setNote(e.target.value)} />
          </label>}
          <div className="success__actions">
            {pending ? <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void changeStatus(pending.action)}>{busy ? 'Saving…' : 'Retry same status change'}</button>
              : ACTIONS.filter((item) => item.status.includes(application.status)).map((item) => <button type="button" key={item.action}
                className="btn btn--secondary btn--sm" disabled={busy || (item.action === 'respond' && !note.trim())}
                onClick={() => void changeStatus(item.action)}>{item.label}</button>)}
          </div>
          {pending && error && <p className="fineprint">The server may have saved this change. Retry with the same action key to confirm it.</p>}
          <h3 className="form-section-title">Saved answers</h3>
          {service && <ReviewSummary steps={steps.filter((step) => step.fields.length)} formData={formData} requirements={service.requirements} onEdit={undefined} />}
        </>}
      </div>
      <div className="modal__footer">
        {application && service && !loading && <button type="button" className="btn btn--secondary" onClick={() => downloadReviewPacket({
          service, steps, formData, referenceId: application.reference_id, submittedAt: new Date(application.submitted_at),
        })}><Download size={16} /> Download saved application</button>}
        <button type="button" className="btn btn--primary" onClick={onClose}>Done</button>
      </div>
    </div>
  </div>;
}
