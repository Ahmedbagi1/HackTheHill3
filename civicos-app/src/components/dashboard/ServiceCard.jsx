import { ArrowRight, Clock, Sparkles, Volume2 } from "lucide-react";
import TierBadge from "../common/TierBadge";
import { useLanguage } from "../../context/LanguageContext";

/**
 * @param {{
 *   service: any,
 *   stepNumber?: number,
 *   recommendedStep?: number,
 *   onStart: (service: any) => void,
 *   onListen: (service: any) => void,
 *   onExplain?: (service: any) => void,
 * }} props
 *   stepNumber: position in a keyword life-event checklist.
 *   recommendedStep: position in a Gemini triage pathway.
 *   onExplain: shows the "AI Explain" plain-language button when provided.
 */
const ServiceCard = ({ service, stepNumber = undefined, recommendedStep = undefined, onStart, onListen, onExplain = undefined }) => {
  const { t } = useLanguage();
  const highlighted = Boolean(stepNumber || recommendedStep);
  const Icon = service.icon;
  const tierKey = service.tier.toLowerCase();

  return (
    <article className={`card${highlighted ? " card--highlight" : ""}`} aria-labelledby={`card-${service.id}`}>
      {recommendedStep ? (
        <span className="card__step card__step--ai">
          <Sparkles size={11} aria-hidden="true" />
          {t(`Recommended Step ${recommendedStep}`, `Étape recommandée ${recommendedStep}`)}
        </span>
      ) : (
        stepNumber && <span className="card__step">{t(`Step ${stepNumber}`, `Étape ${stepNumber}`)}</span>
      )}
      <div className="card__head">
        <span className={`card__icon card__icon--${tierKey}`} aria-hidden="true">
          <Icon size={20} />
        </span>
        <div className="card__badges">
          {service.badge && <span className="badge badge--feature">{service.badge}</span>}
          <TierBadge tier={service.tier} />
        </div>
      </div>
      <div className="card__body">
        <h3 id={`card-${service.id}`} className="card__title">
          {service.title}
        </h3>
        <p className="card__agency">{service.agency}</p>
        <p className="card__summary">{service.summary}</p>
        <ul className="card__subservices" aria-label={t("Includes", "Comprend")}>
          {service.subServices.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div className="card__meta">
        <Clock size={14} aria-hidden="true" />
        {service.time}
      </div>
      <div className="card__actions card__actions--stack">
        <button type="button" className="btn btn--primary" onClick={() => onStart(service)}>
          {t("action.startApplication")}
          <ArrowRight size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="btn btn--audio"
          onClick={() => onListen(service)}
          aria-label={t(`Audio summary of ${service.title}, voiced by ElevenLabs`, `Résumé audio de ${service.title}, narré par ElevenLabs`)}
        >
          <Volume2 size={17} aria-hidden="true" />
          {t("audio.summary")}
          <span className="btn__hint" aria-hidden="true">
            ElevenLabs
          </span>
        </button>
        {onExplain && (
          <button
            type="button"
            className="btn btn--ai"
            onClick={() => onExplain(service)}
            aria-label={t(`Explain ${service.title} in plain language with AI`, `Expliquer ${service.title} en langage clair avec l'IA`)}
          >
            <Sparkles size={16} aria-hidden="true" />
            {t("AI Explain", "Explication IA")}
          </button>
        )}
      </div>
    </article>
  );
};

export default ServiceCard;
