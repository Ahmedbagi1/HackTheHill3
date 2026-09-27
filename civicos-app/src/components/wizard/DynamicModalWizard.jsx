import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Download,
  ExternalLink,
  FileBraces,
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
import OfficialSubmissionNotice from "./OfficialSubmissionNotice";
import { buildSteps } from "../../data/servicesData";
import { DISPLAY_ONLY_TYPES, buildInitialFormData, validateFields, visibleFields } from "../../lib/validation";
import { buildReviewPacketHtml, downloadReviewPacket, downloadReviewPacketJson } from "../../lib/reviewPacket";
import { useDialogBehavior } from "../../hooks/useDialogBehavior";
import { useI18n } from "../../i18n/i18nContext";
import { useAnswerLanguage } from "../../i18n/useAnswerLanguage";
import Tx from "../../i18n/Tx";

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
 * Application wizard driven entirely by the service's schema:
 *   Primary details → Applicant & contact (when the form has one) →
 *   Verification & requirements → Review & summary
 * Answers live in one `formData` object, so Back/Next never lose input.
 */
const DynamicModalWizard = ({ service, prefill, prefillSource = "finder", onClose, onListen, onSubmitted, signedIn }) => {
  const { t } = useI18n();
  const lang = useAnswerLanguage();
  const steps = useMemo(() => buildSteps(service.form), [service]);
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState(() => {
    const initial = buildInitialFormData(service.form);
    // Only accept prefilled keys this form actually has.
    for (const [key, value] of Object.entries(prefill ?? {})) {
      if (key in initial && value !== undefined && value !== "") initial[key] = typeof value === 'number' ? String(value) : value;
    }
    return initial;
  });
  const isPrefilled = Boolean(prefill && Object.keys(prefill).length);
  const [errors, setErrors] = useState({});
  const [submission, setSubmission] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [demoAcknowledged, setDemoAcknowledged] = useState(false);
  const [hasAttempt, setHasAttempt] = useState(false);
  const attemptRef = useRef(null);
  const busyRef = useRef(false);
  const bodyRef = useRef(null);

  const lastStep = steps.length - 1;
  const currentStep = steps[step];
  const answerSteps = steps.slice(0, lastStep);

  const close = useCallback(() => { if (!busyRef.current) onClose(); }, [onClose]);
  useDialogBehavior(close);

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

  // Saved answers are the server-normalized copy; drafts use the live form.
  const packetFormData = submission ? { ...submission.payload.answers, consent: true } : formData;
  const packetInput = (referenceId, submittedAt) => ({
    service,
    steps,
    formData: packetFormData,
    referenceId,
    submittedAt,
    lang,
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (busyRef.current || submission) return;

    const stepErrors =
      step < lastStep
        ? validateFields(currentStep.fields, formData)
        : {
          ...validateFields(answerSteps.flatMap((item) => item.fields), formData),
          ...(!formData.consent && { consent: 'Please consent to saving this test application.' }),
          ...(!demoAcknowledged && { demoAcknowledged: 'Confirm that you are using test information only.' }),
        };
    setErrors(stepErrors);

    const firstInvalid = Object.keys(stepErrors)[0];
    if (firstInvalid) {
      if (step === lastStep) {
        const invalidStep = answerSteps.findIndex((item) => item.fields.some((field) => field.name === firstInvalid));
        if (invalidStep >= 0) setStep(invalidStep);
      }
      bodyRef.current?.querySelector(`[name="${firstInvalid}"], #field-${firstInvalid}`)?.focus();
      return;
    }

    if (step < lastStep) setStep(step + 1);
    else {
      if (!signedIn) { setSaveError('Sign in with a verified account using Profile before starting your application.'); return; }
      if (!attemptRef.current) {
        const fields = answerSteps.flatMap((item) => item.fields).filter((field) => !DISPLAY_ONLY_TYPES.has(field.type));
        attemptRef.current = {
          serviceId: service.id, requestKey: crypto.randomUUID(),
          payload: { answers: Object.fromEntries(fields.map((field) => [field.name, formData[field.name]])), consent: true, demoAcknowledged: true },
        };
        setHasAttempt(true);
      }
      busyRef.current = true; setBusy(true); setSaveError(null);
      try {
        const saved = await onSubmitted(attemptRef.current);
        setSubmission({ referenceId: saved.reference_id, submittedAt: new Date(saved.submitted_at), payload: saved.payload });
      } catch (error) {
        setSaveError(error.message || 'Saving could not be confirmed. Retry before starting another application.');
        // Only a definite validation rejection permits editing. A lost response
        // may follow a committed insert, so retries keep identical answers/key.
        if (error.code === 'VALIDATION') { attemptRef.current = null; setHasAttempt(false); }
      } finally {
        busyRef.current = false; setBusy(false);
      }
    }
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
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
              {submission ? t("Application submitted") : t(service.agency)}
            </p>
            <h2 id="wizard-title" className="modal__title">
              {t(service.title)}
              <TierBadge tier={service.tier} />
            </h2>
          </div>
          <div className="modal__header-actions">
            <button
              type="button"
              className="icon-btn"
              aria-label={t("Audio summary of {service}, voiced by ElevenLabs", { service: t(service.title) })}
              title={t("Audio summary")}
              onClick={() => onListen(service)}
            >
              <Volume2 size={19} />
            </button>
            <button type="button" className="icon-btn" aria-label={t("Close")} onClick={close} disabled={busy}>
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
              <p className="success__title">{t("Saved to your CivicOS account")}</p>
              <p className="success__text">
                {t("Your test application is saved. Return to Your requests to view it or try prototype processing.")}{" "}
                {t("Nothing was sent to a government service.")}
              </p>
              <span className="success__ref">{submission.referenceId}</span>
              <OfficialSubmissionNotice service={service} formData={packetFormData} complete />
              <div className="success__actions">
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => downloadReviewPacket(packetInput(submission.referenceId, submission.submittedAt))}
                >
                  <Download size={16} aria-hidden="true" /> {t("Download review packet")}
                </button>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => printPacket(packetInput(submission.referenceId, submission.submittedAt))}
                >
                  <Printer size={16} aria-hidden="true" /> {t("Print")}
                </button>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => downloadReviewPacketJson(packetInput(submission.referenceId, submission.submittedAt))}
                >
                  <FileBraces size={16} aria-hidden="true" /> {t("Download data (JSON)")}
                </button>
              </div>
              <a className="success__link" href={service.officialUrl} target="_blank" rel="noreferrer">
                {t("Official information")} <ExternalLink size={12} aria-hidden="true" />
              </a>
            </div>
          ) : (
            <>
              <p className="callout">Demo environment — use test information only. Do not enter real government identification numbers or sensitive personal information. Nothing is sent to government systems.</p>
              {!signedIn && <p className="field__error" role="alert">Sign in with a verified account using Profile before filling this form. Signing in clears this unsaved draft.</p>}
              {saveError && <p className="field__error" role="alert">{saveError} {hasAttempt && 'Your answers are kept for an identical retry. If you close this form, check Your requests before submitting again.'}</p>}
              {busy && <p role="status">Saving your application…</p>}
              <fieldset disabled={busy || hasAttempt} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
              <StepIndicator steps={steps} current={step} onSelect={goToStep} />

              {isPrefilled && step === 0 && (
                <p className="callout prefill-note">
                  <Sparkles size={16} aria-hidden="true" />
                  {prefillSource === "assistant"
                    ? t("We've started this form from your conversation with the assistant. Review it before continuing.")
                    : t("We've filled in answers from your benefits check. Review them before continuing.")}
                </p>
              )}
              <p className="form-section-progress">{t("Step {current} of {total}", { current: step + 1, total: steps.length })}</p>
              <h3 className="form-section-title">{t(currentStep.title)}</h3>
              <Tx as="p" className="form-section-text" text={currentStep.description} />

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
                  <OfficialSubmissionNotice service={service} formData={formData} />
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
                    <span>{t("I consent to saving these test answers in my CivicOS account for prototype processing.")}</span>
                  </label>
                  {errors.consent && (
                    <p className="field__error" role="alert">
                      <CircleAlert size={13} aria-hidden="true" />
                      {t(errors.consent)}
                    </p>
                  )}
                  <label className="checkbox">
                    <input type="checkbox" name="demoAcknowledged" checked={demoAcknowledged} onChange={(e) => setDemoAcknowledged(e.target.checked)} />
                    <span>I am using test information only, including test identification numbers.</span>
                  </label>
                  {errors.demoAcknowledged && <p className="field__error" role="alert">{errors.demoAcknowledged}</p>}
                  <button
                    type="button"
                    className="link-btn review-download"
                    onClick={() => downloadReviewPacket(packetInput(null, new Date()))}
                  >
                    <Download size={13} aria-hidden="true" /> {t("Download a draft copy")}
                  </button>
                </>
              )}
              </fieldset>
            </>
          )}
        </div>

        <div className="modal__footer">
          {submission ? (
            <div className="modal__footer-end">
              <button type="button" className="btn btn--primary" onClick={onClose}>
                {t("Done")}
              </button>
            </div>
          ) : (
            <>
              {step > 0 ? (
                <button type="button" className="btn btn--secondary" onClick={() => goToStep(step - 1)} disabled={busy || hasAttempt}>
                  <ChevronLeft size={16} aria-hidden="true" />
                  {t("Back")}
                </button>
              ) : (
                <button type="button" className="btn btn--ghost" onClick={onClose}>
                  {t("Cancel")}
                </button>
              )}
              <div className="modal__footer-end">
                {step < lastStep ? (
                  <button type="submit" className="btn btn--primary">
                    {t("Next")}
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                ) : (
                  <button type="submit" className="btn btn--success" disabled={busy || !signedIn}>
                    <ShieldCheck size={16} aria-hidden="true" />
                    {t(busy ? 'Saving…' : hasAttempt ? 'Retry save' : 'Submit application')}
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
