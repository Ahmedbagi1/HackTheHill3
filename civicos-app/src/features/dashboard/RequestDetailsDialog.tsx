import { Check, ExternalLink, X } from "lucide-react";
import { useDialogBehavior } from "../../hooks/useDialogBehavior";
import { SERVICES_BY_ID } from "../../data/servicesData";
import { DemoTag } from "../../components/ui/primitives";
import { useI18n } from "../../i18n/i18nContext";
import type { UserRequest } from "../../types/dashboard";

export default function RequestDetailsDialog({ request, onClose }: { request: UserRequest; onClose: () => void }) {
  useDialogBehavior(onClose);
  const { t, tm, formatDate } = useI18n();
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
              {t(request.title)}
              {request.demo && <DemoTag />}
            </h2>
          </div>
          <button type="button" className="icon-btn" aria-label={t("Close")} onClick={onClose}>
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
                  <p className="timeline__label">{t(stage.label)}</p>
                  <p className="timeline__meta">
                    {stage.state === "done" && stage.date && t("Completed {date}", { date: formatDate(stage.date) })}
                    {stage.state === "current" && (stage.date ? t("Expected by {date}", { date: formatDate(stage.date) }) : t("In progress"))}
                    {stage.state === "blocked" && t("Waiting on you")}
                    {stage.state === "upcoming" && (stage.date ? t("Around {date}", { date: formatDate(stage.date) }) : t("Upcoming"))}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <dl className="review-list">
            {request.summary.map((item) => (
              <div key={item.label}>
                <dt>{t(item.label)}</dt>
                <dd>{tm(item.value)}</dd>
              </div>
            ))}
            <div>
              <dt>{t("Submitted")}</dt>
              <dd>{formatDate(request.submittedAt)}</dd>
            </div>
          </dl>
          <p className="fineprint">{t("Stages are simulated from typical processing times. Follow up with the program using your reference number.")}</p>
        </div>
        <div className="modal__footer">
          {service?.officialUrl ? (
            <a className="btn btn--ghost" href={service.officialUrl} target="_blank" rel="noreferrer">
              {t("Official site")} <ExternalLink size={14} aria-hidden="true" />
            </a>
          ) : (
            <span />
          )}
          <button type="button" className="btn btn--primary" onClick={onClose}>
            {t("Done")}
          </button>
        </div>
      </div>
    </div>
  );
}
