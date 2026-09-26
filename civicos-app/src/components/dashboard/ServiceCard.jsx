import { ArrowRight, Clock, Volume2 } from "lucide-react";
import TierBadge from "../common/TierBadge";

const ServiceCard = ({ service, stepNumber, onStart, onListen }) => {
  const Icon = service.icon;
  const tierKey = service.tier.toLowerCase();

  return (
    <article className={`card${stepNumber ? " card--highlight" : ""}`} aria-labelledby={`card-${service.id}`}>
      {stepNumber && <span className="card__step">Step {stepNumber}</span>}
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
        <h2 id={`card-${service.id}`} className="card__title">
          {service.title}
        </h2>
        <p className="card__agency">{service.agency}</p>
        <p className="card__summary">{service.summary}</p>
        <ul className="card__subservices" aria-label="Includes">
          {service.subServices.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div className="card__meta">
        <Clock size={14} aria-hidden="true" />
        {service.time}
      </div>
      <div className="card__actions">
        <button type="button" className="btn btn--primary" onClick={() => onStart(service)}>
          Start application
          <ArrowRight size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="btn btn--secondary btn--icon"
          onClick={() => onListen(service)}
          aria-label={`Explain ${service.title} to me`}
          title="Explain to citizen"
        >
          <Volume2 size={17} aria-hidden="true" />
        </button>
      </div>
    </article>
  );
};

export default ServiceCard;
