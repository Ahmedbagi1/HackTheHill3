import { Check, ExternalLink, X } from "lucide-react";
import { useDialogBehavior } from "../../hooks/useDialogBehavior";
import { SERVICES_BY_ID } from "../../data/servicesData";
import { DemoTag } from "../../components/ui/primitives";
import { shortDate } from "../../lib/time";
import type { UserRequest } from "../../types/dashboard";
import SavedApplicationDetails from './SavedApplicationDetails';

export default function RequestDetailsDialog({ request, onClose }: { request: UserRequest; onClose: () => void }) {
  return request.persistence === 'supabase'
    ? <SavedApplicationDetails id={request.id} onClose={onClose} />
    : <LocalRequestDetailsDialog request={request} onClose={onClose} />;
}

function LocalRequestDetailsDialog({ request, onClose }: { request: UserRequest; onClose: () => void }) {
  useDialogBehavior(onClose);
  const service = (SERVICES_BY_ID as Record<string, { officialUrl?: string; agency?: string } | undefined>)[request.serviceId];

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="request-title">
        <div className="modal__header">
          <div>
            <p className="modal__eyebrow">
              <span className="mono">{request.referenceId}</span>
            </p>
            <h2 id="request-title" className="modal__title">
              {request.title}
              {request.demo && <DemoTag />}
            </h2>
          </div>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="modal__body">
          <ol className="timeline">
            {request.stages.map((stage) => (
              <li key={stage.key} className={`timeline__item timeline__item--${stage.state}`}>
                <span className="timeline__dot" aria-hidden="true">
                  {stage.state === "done" && <Check size={11} strokeWidth={3} />}
                </span>
                <div>
                  <p className="timeline__label">{stage.label}</p>
                  <p className="timeline__meta">
                    {stage.state === "done" && stage.date && `Completed ${shortDate(stage.date)}`}
                    {stage.state === "current" && (stage.date ? `Expected by ${shortDate(stage.date)}` : "In progress")}
                    {stage.state === "blocked" && "Waiting on you"}
                    {stage.state === "upcoming" && (stage.date ? `Around ${shortDate(stage.date)}` : "Upcoming")}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <dl className="review-list">
            {request.summary.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
            <div>
              <dt>Submitted</dt>
              <dd>{shortDate(request.submittedAt)}</dd>
            </div>
          </dl>
          <p className="fineprint">Browser-only prototype record, not a Supabase submission. Stages are simulated. This reference is only for CivicOS and cannot be used with government programs.</p>
        </div>
        <div className="modal__footer">
          {service?.officialUrl ? (
            <a className="btn btn--ghost" href={service.officialUrl} target="_blank" rel="noreferrer">
              Official site <ExternalLink size={14} aria-hidden="true" />
            </a>
          ) : (
            <span />
          )}
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
