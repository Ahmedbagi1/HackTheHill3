import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Download,
  ExternalLink,
  Printer,
  ShieldCheck,
  Sparkles,
  Volume2,
  X,
} from "lucide-react";
import TierBadge from "../common/TierBadge";
import FieldRenderer from "./FieldRenderer";
import ReviewSummary from "./ReviewSummary";
import StepIndicator from "./StepIndicator";
import { buildSteps } from "../../data/servicesData";
import { DISPLAY_ONLY_TYPES, buildInitialFormData, isEmptyValue, validateFields, visibleFields } from "../../lib/validation";
import { formatAnswer } from "../../lib/formatting";
import { buildReviewPacketHtml, downloadReviewPacket } from "../../lib/reviewPacket";
import { useDialogBehavior } from "../../hooks/useDialogBehavior";
import { useLanguage } from "../../context/LanguageContext";
import QuickAutoFill from "../../features/ai/QuickAutoFill";

const makeReferenceId = () => `CIV-${Date.now().toString(36).toUpperCase()}`;

/** First few answered questions, used as the request summary on the dashboard. */
const summarizeAnswers = (steps, formData, lang, limit = 3) =>
  steps
    .flatMap((step) => visibleFields(step.fields, formData))
    .filter((field) => !DISPLAY_ONLY_TYPES.has(field.type) && !isEmptyValue(field, formData[field.name]))
    .slice(0, limit)
    .map((field) => ({ label: field.reviewLabel ?? field.label, value: formatAnswer(field, formData[field.name], formData, lang) }));

const printPacket = (packetInput) => {
  const url = URL.createObjectURL(
    new Blob([buildReviewPacketHtml(packetInput)], { type: "text/html;charset=utf-8" }),
  );
  const printWindow = window.open(url, "_blank");
  if (!printWindow) {
    URL.revokeObjectURL(url);
    return;
  }
  printWindow.addEventListener("load", () => {
    printWindow.print();
    URL.revokeObjectURL(url);
  });
};

/**
 * Three-step application wizard driven entirely by the service's schema:
 *   1. Primary details   2. Verification & requirements   3. Review & summary
 * Answers live in one `formData` object, so Back/Next never lose input.
 */
const DynamicModalWizard = ({ service, prefill, onClose, onListen, onSubmitted }) => {
  const { currentLang, t } = useLanguage();
  const steps = useMemo(() => buildSteps(service.form, currentLang), [service, currentLang]);
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState(() => {
    const initial = buildInitialFormData(service.form);
    // Only accept prefilled keys this form actually has.
    for (const [key, value] of Object.entries(prefill ?? {})) {
      if (key in initial && value !== undefined && value !== "") initial[key] = value;
    }
    return initial;
  });
  const isPrefilled = Boolean(prefill && Object.keys(prefill).length);
  const [errors, setErrors] = useState({});
  const [submission, setSubmission] = useState(null);
  const bodyRef = useRef(null);

  const lastStep = steps.length - 1;
  const currentStep = steps[step];
  const answerSteps = steps.slice(0, lastStep);

  useDialogBehavior(onClose);

  // Focus the first control on each step and scroll back to the top.
  useEffect(() => {
    bodyRef.current?.querySelector(".fields input, .fields select, .fields textarea")?.focus();
    bodyRef.current?.scrollTo({ top: 0 });
  }, [step]);

  // Auto-filled fields stay marked (and flash when shown) until the citizen edits them, including on later steps.
  const [aiFilled, setAiFilled] = useState(() => new Set());

  const applyAutoFill = (values, filled) => {
    setFormData((prev) => ({ ...prev, ...values }));
    setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([name]) => !(name in values))));
    setAiFilled(new Set(filled));
  };

  const updateField = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    setAiFilled((prev) => {
      if (!prev.has(name)) return prev;
      const next = new Set(prev);
      next.delete(name);
      return next;
    });
    setErrors((prev) => {
      if (!(name in prev)) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const goToStep = (index) => {
    setErrors({});
    setStep(index);
  };

  const packetInput = (referenceId, submittedAt) => ({
    service,
    steps,
    formData,
    referenceId,
    submittedAt,
    lang: currentLang,
  });

  const handleSubmit = (event) => {
    event.preventDefault();

    const stepErrors =
      step < lastStep
        ? validateFields(currentStep.fields, formData)
        : formData.consent
          ? {}
          : { consent: t("Please confirm the information is accurate.", "Veuillez confirmer que les renseignements sont exacts.") };
    setErrors(stepErrors);

    const firstInvalid = Object.keys(stepErrors)[0];
    if (firstInvalid) {
      bodyRef.current?.querySelector(`[name="${firstInvalid}"], #field-${firstInvalid}`)?.focus();
      return;
    }

    if (step < lastStep) setStep(step + 1);
    else {
      const referenceId = makeReferenceId();
      setSubmission({ referenceId, submittedAt: new Date() });
      onSubmitted?.({
        serviceId: service.id,
        title: service.title,
        referenceId,
        summary: summarizeAnswers(steps.slice(0, lastStep), formData, currentLang),
      });
    }
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wizard-title"
        onSubmit={handleSubmit}
        noValidate
      >
        <div className="modal__header">
          <div>
            <p className="modal__eyebrow">
              {submission ? t("Application submitted", "Demande soumise") : service.agency}
            </p>
            <h2 id="wizard-title" className="modal__title">
              {service.title}
              <TierBadge tier={service.tier} />
            </h2>
          </div>
          <div className="modal__header-actions">
            <button
              type="button"
              className="icon-btn"
              aria-label={`${t("audio.summary")}: ${service.title}`}
              title={t("audio.summary")}
              onClick={() => onListen(service)}
            >
              <Volume2 size={19} />
            </button>
            <button type="button" className="icon-btn" aria-label={t("Close", "Fermer")} onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="modal__body" ref={bodyRef}>
          {submission ? (
            <div className="success" role="status">
              <span className="success__icon" aria-hidden="true">
                <CircleCheck size={34} />
              </span>
              <p className="success__title">You're all set!</p>
              <p className="success__text">
                We've received your {service.title} request. {service.form.confirmation} Estimated
                time: {service.time}.
              </p>
              <span className="success__ref">{submission.referenceId}</span>
              <div className="success__actions">
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => downloadReviewPacket(packetInput(submission.referenceId, submission.submittedAt))}
                >
                  <Download size={16} aria-hidden="true" /> {t("Download review packet", "Télécharger le récapitulatif")}
                </button>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => printPacket(packetInput(submission.referenceId, submission.submittedAt))}
                >
                  <Printer size={16} aria-hidden="true" /> {t("Print", "Imprimer")}
                </button>
              </div>
              <a className="success__link" href={service.officialUrl} target="_blank" rel="noreferrer">
                {t("Official information", "Renseignements officiels")} <ExternalLink size={12} aria-hidden="true" />
              </a>
            </div>
          ) : (
            <>
              <StepIndicator steps={steps} current={step} onSelect={goToStep} />

              {isPrefilled && step === 0 && (
                <p className="callout prefill-note">
                  <Sparkles size={16} aria-hidden="true" />
                  {t(
                    "We've filled in answers from your benefits check. Review them before continuing.",
                    "Nous avons rempli des réponses à partir de votre vérification des prestations. Vérifiez-les avant de continuer.",
                  )}
                </p>
              )}
              {step === 0 && <QuickAutoFill fields={answerSteps.flatMap((answerStep) => answerStep.fields)} onApply={applyAutoFill} />}
              <h3 className="form-section-title">
                {t(`Step ${step + 1}: ${currentStep.title}`, `Étape ${step + 1} : ${currentStep.title}`)}
              </h3>
              <p className="form-section-text">{currentStep.description}</p>

              {step < lastStep ? (
                <div className="fields fields--two">
                  {visibleFields(currentStep.fields, formData).map((field) => (
                    <FieldRenderer
                      key={field.name}
                      field={field}
                      value={formData[field.name]}
                      error={errors[field.name]}
                      formData={formData}
                      onChange={updateField}
                      highlighted={aiFilled.has(field.name)}
                    />
                  ))}
                </div>
              ) : (
                <>
                  <ReviewSummary
                    steps={answerSteps}
                    formData={formData}
                    requirements={service.requirements}
                    onEdit={goToStep}
                  />
                  <label className={`checkbox${errors.consent ? " checkbox--error" : ""}`}>
                    <input
                      type="checkbox"
                      name="consent"
                      checked={formData.consent}
                      onChange={(e) => updateField("consent", e.target.checked)}
                    />
                    <span>
                      I confirm the information above is accurate and I consent to it being used to
                      process this request.
                    </span>
                  </label>
                  {errors.consent && (
                    <p className="field__error" role="alert">
                      <CircleAlert size={13} aria-hidden="true" />
                      {errors.consent}
                    </p>
                  )}
                  <button
                    type="button"
                    className="link-btn review-download"
                    onClick={() => downloadReviewPacket(packetInput(null, new Date()))}
                  >
                    <Download size={13} aria-hidden="true" /> {t("Download a draft copy", "Télécharger une copie provisoire")}
                  </button>
                </>
              )}
            </>
          )}
        </div>

        <div className="modal__footer">
          {submission ? (
            <div className="modal__footer-end">
              <button type="button" className="btn btn--primary" onClick={onClose}>
                {t("wizard.done")}
              </button>
            </div>
          ) : (
            <>
              {step > 0 ? (
                <button type="button" className="btn btn--secondary" onClick={() => goToStep(step - 1)}>
                  <ChevronLeft size={16} aria-hidden="true" />
                  {t("wizard.back")}
                </button>
              ) : (
                <button type="button" className="btn btn--ghost" onClick={onClose}>
                  {t("wizard.cancel")}
                </button>
              )}
              <div className="modal__footer-end">
                {step < lastStep ? (
                  <button type="submit" className="btn btn--primary">
                    {t("wizard.next")}
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                ) : (
                  <button type="submit" className="btn btn--success">
                    <ShieldCheck size={16} aria-hidden="true" />
                    {t("wizard.submit")}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </form>
    </div>
  );
};

export default DynamicModalWizard;
