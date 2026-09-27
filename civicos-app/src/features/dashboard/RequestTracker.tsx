import { ArrowRight, Check, CircleAlert, ClipboardList, Hourglass, Sparkles, Trash } from "lucide-react";
import { DemoTag, SectionCard } from "../../components/ui/primitives";
import { useCivicData } from '../../state/civicDataStore';
import { APPLICATION_STATUS_LABELS } from '../../state/savedApplicationView';
import { useI18n } from "../../i18n/i18nContext";
import type { UserRequest } from "../../types/dashboard";

interface Props {
  requests: UserRequest[];
  onOpen: (request: UserRequest) => void;
  onWithdraw: (request: UserRequest) => void;
  onSeedDemo: () => void;
  onClearDemo: () => void;
  onBrowse: () => void;
}

function StageTrack({ request }: { request: UserRequest }) {
  const { t, formatDate } = useI18n();
  return (
    <ol className="track" aria-label={t("Progress for {title}", { title: t(request.title) })}>
      {request.stages.map((stage, index) => {
        const label = `${t(stage.label)}: ${t(
          stage.state === "done" ? "complete" : stage.state === "blocked" ? "action needed" : stage.state === "current" ? "in progress" : "upcoming",
        )}`;
        return (
          <li key={stage.key} className={`track__step track__step--${stage.state}`} aria-current={index === request.currentStage ? "step" : undefined}>
            <span className="track__dot" aria-hidden="true">
              {stage.state === "done" ? <Check size={11} strokeWidth={3} /> : stage.state === "blocked" ? "!" : null}
            </span>
            <span className="track__label">
              <span className="sr-only">{label}</span>
              <span aria-hidden="true">{t(stage.label)}</span>
              {stage.date && <span className="track__date" aria-hidden="true">{formatDate(stage.date)}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function RequestCard({ request, onOpen, onWithdraw }: { request: UserRequest; onOpen: Props["onOpen"]; onWithdraw: Props["onWithdraw"] }) {
  const { t, tm, formatDate } = useI18n();
  const current = request.stages[request.currentStage];
  const complete = request.persistence === 'supabase' ? request.status === 'completed' : request.currentStage === request.stages.length - 1 && current.state === "done";
  const terminal = request.status && ['completed', 'rejected', 'withdrawn'].includes(request.status);
  return (
    <article className={`request${request.actionRequired ? " request--action" : ""}`}>
      <header className="request__head">
        <div>
          <h3 className="request__title">
            {t(request.title)}
            {request.demo && <DemoTag />}
          </h3>
          <p className="request__meta">
            <span className="mono" style={{ overflowWrap: 'anywhere' }}>{request.referenceId}</span> · {t("Submitted {date}", { date: formatDate(request.submittedAt) })}
            <br />{t(request.persistence === 'supabase' ? 'Saved to your account · Prototype processing' : 'Browser-only prototype · Not saved to Supabase')}
          </p>
        </div>
        <span className={`request__status request__status--${complete ? "done" : current.state}`}>
          {t(request.status ? APPLICATION_STATUS_LABELS[request.status] : complete ? "Complete" : current.state === "blocked" ? "Action required" : current.label)}
        </span>
      </header>

      <StageTrack request={request} />

      <div className="request__foot">
        <dl className="request__facts">
          {request.waitlistPosition !== undefined && !complete && (
            <div>
              <dt>{t("Waitlist position")}</dt>
              <dd>#{request.waitlistPosition}</dd>
            </div>
          )}
          <div>
            <dt>{t(request.persistence === 'supabase' ? 'Processing' : 'Estimated completion')}</dt>
            <dd>
              {request.persistence === 'supabase' ? t('Internal prototype; no government ETA') : request.estimatedCompletion ? (
                formatDate(request.estimatedCompletion)
              ) : request.actionRequired ? (
                t("After your action")
              ) : (
                <span className="request__open">
                  <Hourglass size={12} aria-hidden="true" /> {t("Depends on availability")}
                </span>
              )}
            </dd>
          </div>
          {request.summary.slice(0, 2).map((item) => (
            <div key={item.label}>
              <dt>{t(item.label)}</dt>
              <dd>{tm(item.value)}</dd>
            </div>
          ))}
        </dl>
        <div className="request__actions">
          {request.actionRequired ? (
            <button type="button" className="btn btn--primary btn--sm" onClick={() => onOpen(request)}>
              <CircleAlert size={14} aria-hidden="true" /> {t(request.actionRequired.label)}
            </button>
          ) : (
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => onOpen(request)}>
              {t("View details")} <ArrowRight size={14} aria-hidden="true" />
            </button>
          )}
          {!terminal && <button type="button" className="icon-btn icon-btn--sm" aria-label={t("Withdraw {title}", { title: t(request.title) })} title={t("Withdraw")} onClick={() => onWithdraw(request)}>
            <Trash size={15} />
          </button>}
        </div>
      </div>
      {request.actionRequired && <p className="request__action-detail">{t(request.actionRequired.detail)}</p>}
    </article>
  );
}

export default function RequestTracker({ requests, onOpen, onWithdraw, onSeedDemo, onClearDemo, onBrowse }: Props) {
  const { servicePersistence, signedIn } = useCivicData();
  const { t, tp } = useI18n();
  const hasDemo = requests.some((r) => r.demo);
  const needsAction = requests.filter((r) => r.actionRequired).length;

  return (
    <SectionCard
      id="requests"
      title={
        <>
          {t("Your requests")}
          {requests.length > 0 && <span className="count">{requests.length}</span>}
        </>
      }
      icon={<ClipboardList size={16} />}
      actions={
        hasDemo ? (
          <button type="button" className="link-btn link-btn--muted" onClick={onClearDemo}>
            {t("Clear demo data")}
          </button>
        ) : null
      }
    >
      {!signedIn && <p className="fineprint">Sign in with a verified account using Profile to view your saved applications.</p>}
      {servicePersistence.status === 'loading' && <p role="status">Loading saved applications…</p>}
      {servicePersistence.error && <p className="field__error" role="alert">{servicePersistence.error} Existing records below may be out of date.</p>}
      {signedIn && <button type="button" className="link-btn" disabled={servicePersistence.status === 'loading'} onClick={() => void servicePersistence.refresh()}>Refresh saved applications</button>}
      {requests.length === 0 && ['ready', 'signed_out'].includes(servicePersistence.status) ? (
        <div className="requests-empty">
          <p className="requests-empty__title">{t(signedIn ? 'No saved requests' : 'Explore CivicOS services')}</p>
          <p className="requests-empty__text">{t("Applications you start in CivicOS are tracked here, with each step and what you need to do next.")}</p>
          <div className="requests-empty__actions">
            <button type="button" className="btn btn--primary btn--sm" onClick={onBrowse}>
              {t("Browse services")}
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={onSeedDemo}>
              <Sparkles size={14} aria-hidden="true" /> {t("Load demo profile")}
            </button>
          </div>
        </div>
      ) : (
        <>
          {needsAction > 0 && (
            <p className="requests-summary" role="status">
              <CircleAlert size={15} aria-hidden="true" /> {tp("{count} request needs your attention", "{count} requests need your attention", needsAction)}
            </p>
          )}
          <div className="requests">
            {requests.map((request) => (
              <RequestCard key={request.id} request={request} onOpen={onOpen} onWithdraw={onWithdraw} />
            ))}
          </div>
          {servicePersistence.hasMore && <button type="button" className="btn btn--secondary btn--sm" disabled={servicePersistence.status === 'loading'} onClick={() => void servicePersistence.loadMore()}>Load more saved applications</button>}
          <p className="fineprint">{t("Saved application statuses come from CivicOS prototype actions. Browser-only records retain simulated timelines. CivicOS is not connected to government case systems.")}</p>
        </>
      )}
    </SectionCard>
  );
}
