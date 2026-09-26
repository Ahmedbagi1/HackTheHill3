import { Calculator, ExternalLink } from "lucide-react";

/** Renders an EstimateResult from services/api/benefitCalculators.js or lib/screeners.js. */
const EstimateCard = ({ label, result }) => {
  if (!result) {
    return (
      <div className="estimate estimate--pending">
        <Calculator size={18} aria-hidden="true" />
        <div>
          <p className="estimate__label">{label}</p>
          <p className="estimate__placeholder">Complete the earlier questions to see your result.</p>
        </div>
      </div>
    );
  }

  return (
    <section className={`estimate estimate--${result.status}`} aria-live="polite" aria-label={label}>
      <div className="estimate__main">
        <p className="estimate__label">{label}</p>
        <p className="estimate__headline">{result.headline}</p>
        {result.subline && <p className="estimate__subline">{result.subline}</p>}
      </div>
      {result.breakdown.length > 0 && (
        <dl className="estimate__breakdown">
          {result.breakdown.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {result.notes.length > 0 && (
        <ul className="estimate__notes">
          {result.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
      {(result.period || result.source) && (
        <p className="estimate__source">
          {result.period && <span>{result.period}</span>}
          {result.source && (
            <a href={result.source.url} target="_blank" rel="noreferrer">
              {result.source.label} <ExternalLink size={11} aria-hidden="true" />
            </a>
          )}
        </p>
      )}
    </section>
  );
};

export default EstimateCard;
