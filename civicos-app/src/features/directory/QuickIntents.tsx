import { BusFront, HeartPulse, IdCard, LayoutGrid, Receipt, Recycle } from "lucide-react";
import { QUICK_INTENTS } from "../../data/intents";
import { useI18n } from "../../i18n/i18nContext";
import type { IntentId } from "../../types/directory";

const ICONS: Record<IntentId, typeof LayoutGrid> = {
  all: LayoutGrid,
  ids: IdCard,
  taxes: Receipt,
  "health-family": HeartPulse,
  "transit-housing": BusFront,
  "waste-permits": Recycle,
};

interface Props {
  /** `null` when the chips act as shortcuts (dashboard) rather than a filter. */
  active: IntentId | null;
  counts: Record<IntentId, number>;
  onSelect: (intent: IntentId) => void;
}

export default function QuickIntents({ active, counts, onSelect }: Props) {
  const { t } = useI18n();
  return (
    <div className="intents" role="group" aria-label={t("Quick filters")}>
      {QUICK_INTENTS.map(({ id, label }) => {
        const Icon = ICONS[id];
        const pressed = active === id;
        return (
          <button
            key={id}
            type="button"
            className={`intent${pressed ? " is-active" : ""}`}
            aria-pressed={active === null ? undefined : pressed}
            onClick={() => onSelect(id)}
            disabled={counts[id] === 0 && !pressed}
          >
            <Icon size={16} aria-hidden="true" />
            {t(label)}
            <span className="intent__count">{counts[id]}</span>
          </button>
        );
      })}
    </div>
  );
}
