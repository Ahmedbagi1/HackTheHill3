import { ArrowRight, Baby, ExternalLink, HeartPulse, House, Landmark, Sparkles } from "lucide-react";
import TierBadge from "../../components/common/TierBadge";
import type { ModuleEntry } from "../../data/categories";
import { useI18n } from "../../i18n/i18nContext";
import Tx from "../../i18n/Tx";
import type { ProvincialPortal } from "../../types/directory";

const MODULE_ICONS = { housing: House, doctor: HeartPulse, autism: Baby } as const;

/** Guided CivicOS program with its own intake, eligibility logic and tracking. */
export function ModuleCard({ module, onOpen }: { module: ModuleEntry; onOpen: (id: ModuleEntry["id"]) => void }) {
  const { t } = useI18n();
  const Icon = MODULE_ICONS[module.id];
  return (
    <article className="card card--module" aria-labelledby={`card-${module.id}`}>
      <div className="card__head">
        <span className="card__icon card__icon--provincial" aria-hidden="true">
          <Icon size={20} />
        </span>
        <div className="card__badges">
          <span className="badge badge--feature">
            <Sparkles size={11} aria-hidden="true" /> {t("Guided program")}
          </span>
          <TierBadge tier="Provincial" />
        </div>
      </div>
      <div className="card__body">
        <Tx as="h4" id={`card-${module.id}`} className="card__title" text={module.title} />
        <p className="card__agency">{t("Government of Ontario")}</p>
        <Tx as="p" className="card__summary" text={module.summary} />
      </div>
      <div className="card__footer">
        <button type="button" className="btn btn--primary" onClick={() => onOpen(module.id)}>
          {t("Open program")}
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

/** Official service in a province or territory CivicOS doesn't process applications for. */
export function PortalCard({ portal }: { portal: ProvincialPortal }) {
  const { t } = useI18n();
  return (
    <article className="card card--portal" aria-labelledby={`card-${portal.id}`}>
      <div className="card__head">
        <span className="card__icon card__icon--provincial" aria-hidden="true">
          <Landmark size={20} />
        </span>
        <div className="card__badges">
          <span className="badge badge--neutral">{portal.province}</span>
          <TierBadge tier="Provincial" />
        </div>
      </div>
      <div className="card__body">
        <Tx as="h4" id={`card-${portal.id}`} className="card__title" text={portal.title} />
        <Tx as="p" className="card__agency" text={portal.agency} />
        <Tx as="p" className="card__summary" text={portal.summary} />
      </div>
      <div className="card__footer">
        <a className="btn btn--primary" href={portal.url} target="_blank" rel="noreferrer">
          {t("Visit official site")}
          <ExternalLink size={15} aria-hidden="true" />
          <span className="sr-only">{t("(opens in a new tab)")}</span>
        </a>
      </div>
    </article>
  );
}
