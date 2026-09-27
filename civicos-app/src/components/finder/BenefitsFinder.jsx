import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Info,
  PiggyBank,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import FieldRenderer from "../wizard/FieldRenderer";
import StepIndicator from "../wizard/StepIndicator";
import BenefitsBreakdownBar from "./BenefitsBreakdownBar";
import { FINDER_STEPS, INITIAL_FINDER_ANSWERS, prefillFor, runBenefitsFinder } from "../../lib/benefitsFinder";
import { validateFields, visibleFields } from "../../lib/validation";
import { useCountUp } from "../../hooks/useCountUp";
import { useDialogBehavior } from "../../hooks/useDialogBehavior";
import { useI18n } from "../../i18n/i18nContext";
import Tx from "../../i18n/Tx";

const HeroTotal = ({ total }) => {
  const { t, formatMoney } = useI18n();
  const shown = useCountUp(total);
  return (
    <div className="finder-hero">
      <p className="finder-hero__label">{t("You may qualify for")}</p>
      <p className="finder-hero__value" aria-hidden="true">
        {formatMoney(shown)}
        <span className="finder-hero__unit">{t("/year")}</span>
      </p>
      {/* Screen readers get the final figure, not every animation frame. */}
      <p className="sr-only">{t("{amount} per year", { amount: formatMoney(total) })}</p>
      <p className="finder-hero__sub">{t("≈ {amount} a month in tax-free benefits and grants", { amount: formatMoney(total / 12, true) })}</p>
    </div>
  );
};

const Results = ({ results, onApply, onEdit }) => {
  const { t, formatMoney } = useI18n();
  const { total, cash, other } = results;

  return (
    <div className="finder-results">
      {total > 0 ? (
        <HeroTotal total={total} />
      ) : (
        <div className="finder-hero finder-hero--empty">
          <p className="finder-hero__label">{t("No cash benefits found")}</p>
          <p className="finder-hero__sub">
            {t("Based on your answers you're above the income limits for these programs. Coverage and support you may still qualify for is listed below.")}
          </p>
        </div>
      )}

      <BenefitsBreakdownBar items={cash} total={total} />

      {cash.length > 0 && (
        <section className="finder-section" aria-labelledby="finder-cash">
          <h3 id="finder-cash" className="finder-section__title">
            {t("Counted in your total")}
          </h3>
          <ul className="finder-list">
            {cash.map((item) => (
              <li key={item.id} className="finder-item">
                <span className={`breakdown__swatch breakdown__swatch--${item.slot}`} aria-hidden="true" />
                <div className="finder-item__body">
                  <p className="finder-item__label">{t(item.label)}</p>
                  <Tx as="p" className="finder-item__detail" text={item.detail} />
                </div>
                <p className="finder-item__amount">{formatMoney(item.amount)}</p>
                <button type="button" className="btn btn--primary btn--sm" onClick={() => onApply(item.serviceId)}>
                  {t("Apply")} <ArrowRight size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {other.length > 0 && (
        <section className="finder-section" aria-labelledby="finder-other">
          <h3 id="finder-other" className="finder-section__title">
            {t("Also worth a look (not counted)")}
          </h3>
          <ul className="finder-list">
            {other.map((item) => (
              <li key={item.id} className="finder-item finder-item--other">
                <span className={`finder-item__icon finder-item__icon--${item.tone}`} aria-hidden="true">
                  {item.tone === "good" ? <CircleCheck size={16} /> : <Info size={16} />}
                </span>
                <div className="finder-item__body">
                  <p className="finder-item__label">
                    {t(item.label)} · <span className="finder-item__headline">{t(item.headline)}</span>
                  </p>
                  <Tx as="p" className="finder-item__detail" text={item.detail} />
                </div>
                <button type="button" className="btn btn--secondary btn--sm" onClick={() => onApply(item.serviceId)}>
                  {t("Check")} <ArrowRight size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="finder-footnote">
        <Sparkles size={13} aria-hidden="true" />{" "}
        {t("Estimates use July 2026 – June 2027 federal rates and 2026–27 OSAP rules, and assume you file your 2025 tax return. The OSAP figure is a simplified model. Applying opens each form prefilled with your answers.")}
      </p>

      <button type="button" className="link-btn" onClick={onEdit}>
        <RotateCcw size={13} aria-hidden="true" /> {t("Change my answers")}
      </button>
    </div>
  );
};

/**
 * Five-question benefits check that runs every calculator at once and leads
 * with a single total. "Apply" opens the matching wizard prefilled.
 */
const BenefitsFinder = ({ onClose, onApply }) => {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState(INITIAL_FINDER_ANSWERS);
  const [errors, setErrors] = useState({});
  const [showResults, setShowResults] = useState(false);
  const bodyRef = useRef(null);

  useDialogBehavior(onClose);

  const lastStep = FINDER_STEPS.length - 1;
  const currentStep = FINDER_STEPS[step];
  const results = useMemo(() => (showResults ? runBenefitsFinder(answers) : null), [showResults, answers]);

  useEffect(() => {
    if (!showResults) bodyRef.current?.querySelector(".fields input, .fields select")?.focus();
    bodyRef.current?.scrollTo({ top: 0 });
  }, [step, showResults]);

  const updateField = (name, value) => {
    setAnswers((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      if (!(name in prev)) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const goToStep = (index) => {
    setErrors({});
    setShowResults(false);
    setStep(index);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const stepErrors = validateFields(currentStep.fields, answers);
    setErrors(stepErrors);
    const firstInvalid = Object.keys(stepErrors)[0];
    if (firstInvalid) {
      bodyRef.current?.querySelector(`[name="${firstInvalid}"]`)?.focus();
      return;
    }
    if (step < lastStep) setStep(step + 1);
    else setShowResults(true);
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        className="modal finder"
        role="dialog"
        aria-modal="true"
        aria-labelledby="finder-title"
        onSubmit={handleSubmit}
        noValidate
      >
        <div className="modal__header">
          <div>
            <p className="modal__eyebrow">
              <PiggyBank size={13} aria-hidden="true" /> {t("Benefits check · 5 questions")}
            </p>
            <h2 id="finder-title" className="modal__title">
              {t("Money you might be missing")}
            </h2>
          </div>
          <button type="button" className="icon-btn" aria-label={t("Close")} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal__body" ref={bodyRef}>
          {showResults ? (
            <Results results={results} onApply={(serviceId) => onApply(serviceId, prefillFor(serviceId, answers))} onEdit={() => goToStep(0)} />
          ) : (
            <>
              <StepIndicator steps={FINDER_STEPS} current={step} onSelect={goToStep} />
              <p className="form-section-progress">{t("Step {current} of {total}", { current: step + 1, total: FINDER_STEPS.length })}</p>
              <h3 className="form-section-title">{t(currentStep.title)}</h3>
              <Tx as="p" className="form-section-text" text={currentStep.description} />
              <div className="fields fields--two">
                {visibleFields(currentStep.fields, answers).map((field) => (
                  <FieldRenderer
                    key={field.name}
                    field={field}
                    value={answers[field.name]}
                    error={errors[field.name]}
                    formData={answers}
                    onChange={updateField}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <div className="modal__footer">
          {showResults ? (
            <div className="modal__footer-end">
              <button type="button" className="btn btn--primary" onClick={onClose}>
                {t("Done")}
              </button>
            </div>
          ) : (
            <>
              {step > 0 ? (
                <button type="button" className="btn btn--secondary" onClick={() => goToStep(step - 1)}>
                  <ChevronLeft size={16} aria-hidden="true" /> {t("Back")}
                </button>
              ) : (
                <button type="button" className="btn btn--ghost" onClick={onClose}>
                  {t("Cancel")}
                </button>
              )}
              <div className="modal__footer-end">
                <button type="submit" className="btn btn--primary">
                  {step < lastStep ? t("Next") : t("Show my results")}
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              </div>
            </>
          )}
        </div>
      </form>
    </div>
  );
};

export default BenefitsFinder;
