import { ArrowRight, Clock, Sparkles, Volume2 } from "lucide-react";
import TierBadge from "../common/TierBadge";
import Tx from "../../i18n/Tx";
import { useI18n } from "../../i18n/i18nContext";

/**
 * @param {{
 *   service: import('../../lib/directory').CatalogService,
 *   stepNumber?: number,
 *   onStart: (service: import('../../lib/directory').CatalogService) => void,
 *   onListen: (service: import('../../lib/directory').CatalogService) => void,
 *   onExplain?: (service: import('../../lib/directory').CatalogService) => void
 * }} props
 */
const ServiceCard = ({ service, stepNumber, onStart, onListen, onExplain }) => {
  const { t } = useI18n();
  const Icon = service.icon;
  const tierKey = service.tier.toLowerCase();

  return (
    <article className={`card${stepNumber ? " card--highlight" : ""}`} aria-labelledby={`card-${service.id}`}>
      {stepNumber && <span className="card__step">{t("Step {number}", { number: stepNumber })}</span>}
      <div className="card__head">
        <span className={`card__icon card__icon--${tierKey}`} aria-hidden="true">
          <Icon size={20} />
        </span>
        <div className="card__badges">
          {service.badge && <span className="badge badge--feature">{t(service.badge)}</span>}
          <TierBadge tier={service.tier} />
        </div>
      </div>
      <div className="card__body">
        <Tx as="h4" id={`card-${service.id}`} className="card__title" text={service.title} />
        <Tx as="p" className="card__agency" text={service.agency} />
        <Tx as="p" className="card__summary" text={service.summary} />
        <ul className="card__subservices" aria-label={t("Includes")}>
          {service.subServices.map((item) => (
            <Tx key={item} as="li" text={item} />
          ))}
        </ul>
      </div>
      <div className="card__meta">
        <Clock size={14} aria-hidden="true" />
        {t(service.time)}
      </div>
      <div className="card__footer">
        {onExplain && (
          <button type="button" className="btn btn--secondary" onClick={() => onExplain(service)}>
            <Sparkles size={16} aria-hidden="true" /> {t("AI Explain")}
          </button>
        )}
        <button type="button" className="btn btn--primary" onClick={() => onStart(service)}>
          {t("Start application")}
          <ArrowRight size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="btn btn--audio"
          onClick={() => onListen(service)}
          aria-label={t("Audio summary of {service}, voiced by ElevenLabs", { service: t(service.title) })}
          title={t("Voiced by ElevenLabs")}
        >
          <Volume2 size={17} aria-hidden="true" />
          {t("Audio summary")}
        </button>
      </div>
    </article>
  );
};

export default ServiceCard;
