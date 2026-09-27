import { Calculator, ExternalLink } from "lucide-react";
import { useI18n } from "../../i18n/i18nContext";
import Tx from "../../i18n/Tx";

/** Renders an EstimateResult from services/api/benefitCalculators.js or lib/screeners.js. */
const EstimateCard = ({ label, result }) => {
  const { t } = useI18n();
  if (!result) {
    return (
      <div className="estimate estimate--pending">
        <Calculator size={18} aria-hidden="true" />
        <div>
          <Tx as="p" className="estimate__label" text={label} />
          <p className="estimate__placeholder">{t("Complete the earlier questions to see your result.")}</p>
        </div>
      </div>
    );
  }

  return (
    <section className={`estimate estimate--${result.status}`} aria-live="polite" aria-label={t(label)}>
      <div className="estimate__main">
        <Tx as="p" className="estimate__label" text={label} />
        <p className="estimate__headline">{t(result.headline)}</p>
        {result.subline && <Tx as="p" className="estimate__subline" text={result.subline} />}
      </div>
      {result.breakdown.length > 0 && (
        <dl className="estimate__breakdown">
          {result.breakdown.map((row) => (
            <div key={row.label}>
              <Tx as="dt" text={row.label} />
              <dd>{t(row.value)}</dd>
            </div>
          ))}
        </dl>
      )}
      {result.notes.length > 0 && (
        <ul className="estimate__notes">
          {result.notes.map((note) => (
            <Tx key={note} as="li" text={note} />
          ))}
        </ul>
      )}
      {(result.period || result.source) && (
        <p className="estimate__source">
          {result.period && <span>{t(result.period)}</span>}
          {result.source && (
            <a href={result.source.url} target="_blank" rel="noreferrer">
              {t(result.source.label)} <ExternalLink size={11} aria-hidden="true" />
            </a>
          )}
        </p>
      )}
    </section>
  );
};

export default EstimateCard;
