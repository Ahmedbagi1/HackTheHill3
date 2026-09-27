import { useState } from "react";
import { useI18n } from "../../i18n/i18nContext";

/**
 * Part-to-whole stacked bar of the cash total. Colour follows the program
 * (fixed slot), a 2px surface gap separates segments, and the legend always
 * carries the values so identity never relies on colour alone.
 */
const BenefitsBreakdownBar = ({ items, total }) => {
  const { t, formatMoney } = useI18n();
  const [active, setActive] = useState(null);
  if (items.length === 0 || total <= 0) return null;

  const segments = items.reduce((acc, item) => {
    const previous = acc.at(-1);
    const start = previous ? previous.start + previous.share : 0;
    return [...acc, { ...item, share: item.amount / total, start }];
  }, []);
  const activeSegment = segments.find((s) => s.id === active);

  return (
    <figure className="breakdown">
      <figcaption className="sr-only">{t("How your estimated total breaks down by program")}</figcaption>
      <div className="breakdown__track" onMouseLeave={() => setActive(null)}>
        {segments.map((segment) => (
          <button
            key={segment.id}
            type="button"
            className={`breakdown__segment breakdown__segment--${segment.slot}${active && active !== segment.id ? " is-dimmed" : ""}`}
            style={{ flexGrow: segment.amount }}
            aria-label={t("{program}: {amount} a year, {percent}% of total", {
              program: t(segment.label),
              amount: formatMoney(segment.amount),
              percent: Math.round(segment.share * 100),
            })}
            onMouseEnter={() => setActive(segment.id)}
            onFocus={() => setActive(segment.id)}
            onBlur={() => setActive(null)}
          >
            <span className="breakdown__fill" />
          </button>
        ))}
        {activeSegment && (
          <div
            className="breakdown__tooltip"
            role="status"
            style={{ left: `${(activeSegment.start + activeSegment.share / 2) * 100}%` }}
          >
            <span className={`breakdown__swatch breakdown__swatch--${activeSegment.slot}`} aria-hidden="true" />
            <strong>{t(activeSegment.label)}</strong>
            <span>
              {t("{amount} / year", { amount: formatMoney(activeSegment.amount) })} · {Math.round(activeSegment.share * 100)}%
            </span>
          </div>
        )}
      </div>

      <ul className="breakdown__legend">
        {segments.map((segment) => (
          <li key={segment.id}>
            <span className={`breakdown__swatch breakdown__swatch--${segment.slot}`} aria-hidden="true" />
            <span className="breakdown__legend-label">{t(segment.label)}</span>
            <span className="breakdown__legend-value">{formatMoney(segment.amount)}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
};

export default BenefitsBreakdownBar;
