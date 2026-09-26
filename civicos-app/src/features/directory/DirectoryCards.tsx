import { ArrowRight, Baby, ExternalLink, HeartPulse, House, Landmark, Sparkles } from "lucide-react";
import type { ModuleEntry } from "../../data/categories";
import type { ProvincialPortal } from "../../types/directory";

const MODULE_ICONS = { housing: House, doctor: HeartPulse, autism: Baby } as const;

/** Guided CivicOS program with its own intake, eligibility logic and tracking. */
export function ModuleCard({ module, onOpen }: { module: ModuleEntry; onOpen: (id: ModuleEntry["id"]) => void }) {
  const Icon = MODULE_ICONS[module.id];
  return (
    <article className="card card--module" aria-labelledby={`card-${module.id}`}>
      <div className="card__head">
        <span className="card__icon card__icon--provincial" aria-hidden="true">
          <Icon size={20} />
        </span>
        <div className="card__badges">
          <span className="badge badge--feature">
            <Sparkles size={11} aria-hidden="true" /> Guided program
          </span>
          <span className="badge badge--provincial">Provincial</span>
        </div>
      </div>
      <div className="card__body">
        <h3 id={`card-${module.id}`} className="card__title">
          {module.title}
        </h3>
        <p className="card__agency">Government of Ontario</p>
        <p className="card__summary">{module.summary}</p>
      </div>
      <div className="card__actions card__actions--stack">
        <button type="button" className="btn btn--primary" onClick={() => onOpen(module.id)}>
          Open program
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

/** Official service in a province or territory CivicOS doesn't process applications for. */
export function PortalCard({ portal }: { portal: ProvincialPortal }) {
  return (
    <article className="card card--portal" aria-labelledby={`card-${portal.id}`}>
      <div className="card__head">
        <span className="card__icon card__icon--provincial" aria-hidden="true">
          <Landmark size={20} />
        </span>
        <div className="card__badges">
          <span className="badge badge--neutral">{portal.province}</span>
          <span className="badge badge--provincial">Provincial</span>
        </div>
      </div>
      <div className="card__body">
        <h3 id={`card-${portal.id}`} className="card__title">
          {portal.title}
        </h3>
        <p className="card__agency">{portal.agency}</p>
        <p className="card__summary">{portal.summary}</p>
      </div>
      <div className="card__actions card__actions--stack">
        <a className="btn btn--primary" href={portal.url} target="_blank" rel="noreferrer">
          Visit official site
          <ExternalLink size={15} aria-hidden="true" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      </div>
    </article>
  );
}
