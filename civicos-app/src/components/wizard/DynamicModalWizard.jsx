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
  Volume2,
  X,
} from "lucide-react";
import TierBadge from "../common/TierBadge";
import FieldRenderer from "./FieldRenderer";
import ReviewSummary from "./ReviewSummary";
import StepIndicator from "./StepIndicator";
import { buildSteps } from "../../data/servicesData";
import { buildInitialFormData, validateFields, visibleFields } from "../../lib/validation";
import { buildReviewPacketHtml, downloadReviewPacket } from "../../lib/reviewPacket";
import { useDialogBehavior } from "../../hooks/useDialogBehavior";

const makeReferenceId = () => `CIV-${Date.now().toString(36).toUpperCase()}`;

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
const DynamicModalWizard = ({ service, onClose, onListen }) => {
  const steps = useMemo(() => buildSteps(service.form), [service]);
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState(() => buildInitialFormData(service.form));
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

  const updateField = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
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
  });

  const handleSubmit = (event) => {
    event.preventDefault();

    const stepErrors =
      step < lastStep
        ? validateFields(currentStep.fields, formData)
        : formData.consent
          ? {}
          : { consent: "Please confirm the information is accurate." };
    setErrors(stepErrors);

    const firstInvalid = Object.keys(stepErrors)[0];
    if (firstInvalid) {
      bodyRef.current?.querySelector(`[name="${firstInvalid}"], #field-${firstInvalid}`)?.focus();
      return;
    }

    if (step < lastStep) setStep(step + 1);
    else setSubmission({ referenceId: makeReferenceId(), submittedAt: new Date() });
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
              {submission ? "Application submitted" : service.agency}
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
              aria-label={`Explain ${service.title} in plain language`}
              title="Explain to me"
              onClick={() => onListen(service)}
            >
              <Volume2 size={19} />
            </button>
            <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
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
                  <Download size={16} aria-hidden="true" /> Download review packet
                </button>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => printPacket(packetInput(submission.referenceId, submission.submittedAt))}
                >
                  <Printer size={16} aria-hidden="true" /> Print
                </button>
              </div>
              <a className="success__link" href={service.officialUrl} target="_blank" rel="noreferrer">
                Official information <ExternalLink size={12} aria-hidden="true" />
              </a>
            </div>
          ) : (
            <>
              <StepIndicator steps={steps} current={step} onSelect={goToStep} />

              <h3 className="form-section-title">
                Step {step + 1}: {currentStep.title}
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
                    <Download size={13} aria-hidden="true" /> Download a draft copy
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
                Done
              </button>
            </div>
          ) : (
            <>
              {step > 0 ? (
                <button type="button" className="btn btn--secondary" onClick={() => goToStep(step - 1)}>
                  <ChevronLeft size={16} aria-hidden="true" />
                  Back
                </button>
              ) : (
                <button type="button" className="btn btn--ghost" onClick={onClose}>
                  Cancel
                </button>
              )}
              <div className="modal__footer-end">
                {step < lastStep ? (
                  <button type="submit" className="btn btn--primary">
                    Next
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                ) : (
                  <button type="submit" className="btn btn--success">
                    <ShieldCheck size={16} aria-hidden="true" />
                    Submit application
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
