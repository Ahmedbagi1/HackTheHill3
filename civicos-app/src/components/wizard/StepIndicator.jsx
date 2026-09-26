import { Check } from "lucide-react";

/** Numbered progress indicator; completed steps are clickable to jump back. */
const StepIndicator = ({ steps, current, onSelect }) => (
  <ol className="stepper" aria-label="Application progress">
    {steps.map((step, index) => {
      const isDone = index < current;
      const isActive = index === current;
      const stateClass = isDone ? " step--done" : isActive ? " step--active" : "";
      return (
        <li key={step.id} className={`step${stateClass}`}>
          <button
            type="button"
            className="step__button"
            disabled={!isDone}
            aria-current={isActive ? "step" : undefined}
            aria-label={`${step.label}${isDone ? " (completed, edit)" : ""}`}
            onClick={() => onSelect(index)}
          >
            {isDone ? <Check size={16} strokeWidth={3} /> : index + 1}
          </button>
          <span className="step__label">{step.label}</span>
        </li>
      );
    })}
  </ol>
);

export default StepIndicator;
