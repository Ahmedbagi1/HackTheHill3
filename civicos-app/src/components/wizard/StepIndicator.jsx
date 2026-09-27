import { Check } from "lucide-react";
import { useI18n } from "../../i18n/i18nContext";

/** Numbered progress indicator; completed steps are clickable to jump back. */
const StepIndicator = ({ steps, current, onSelect }) => {
  const { t } = useI18n();
  return (
    <ol className="stepper" aria-label={t("Application progress")}>
      {steps.map((step, index) => {
        const isDone = index < current;
        const isActive = index === current;
        const stateClass = isDone ? " step--done" : isActive ? " step--active" : "";
        const label = t(step.label);
        return (
          <li key={step.id} className={`step${stateClass}`}>
            <button
              type="button"
              className="step__button"
              disabled={!isDone}
              aria-current={isActive ? "step" : undefined}
              aria-label={isDone ? t("{step} (completed, edit)", { step: label }) : label}
              onClick={() => onSelect(index)}
            >
              {isDone ? <Check size={16} strokeWidth={3} /> : index + 1}
            </button>
            <span className="step__label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
};

export default StepIndicator;
