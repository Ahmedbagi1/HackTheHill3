import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import FieldRenderer from "../../components/wizard/FieldRenderer";
import StepIndicator from "../../components/wizard/StepIndicator";
import { validateFields, visibleFields } from "../../lib/validation";
import { useI18n } from "../../i18n/i18nContext";
import Tx from "../../i18n/Tx";

/** Field schema produced by data/fieldBuilders.js. */
export type FieldSchema = { name: string; type: string; label: string } & Record<string, unknown>;

export interface IntakeStep {
  id: string;
  label: string;
  title: string;
  description: string;
  fields: FieldSchema[];
  /** Extra custom controls rendered after the fields (e.g. a severity matrix). */
  render?: () => ReactNode;
  /** Custom validation beyond the field schemas. */
  validate?: () => Record<string, string>;
}

interface Props {
  steps: IntakeStep[];
  values: Record<string, unknown>;
  onChange: (name: string, value: unknown) => void;
  onComplete: () => void;
  submitLabel: string;
}

/**
 * Multi-step intake built on the shared FieldRenderer and schema validation,
 * so modules get the same inputs, errors and accessibility as the wizard.
 */
export default function IntakeStepper({ steps, values, onChange, onComplete, submitLabel }: Props) {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const current = steps[step];
  const last = step === steps.length - 1;

  useEffect(() => {
    formRef.current?.querySelector<HTMLElement>(".fields input, .fields select, .fields textarea")?.focus();
  }, [step]);

  const change = (name: string, value: unknown) => {
    onChange(name, value);
    setErrors((prev) => {
      if (!(name in prev)) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const stepErrors: Record<string, string> = { ...validateFields(current.fields, values), ...(current.validate?.() ?? {}) };
    setErrors(stepErrors);
    const first = Object.keys(stepErrors)[0];
    if (first) {
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"], #field-${first}`)?.focus();
      return;
    }
    if (last) onComplete();
    else setStep(step + 1);
  };

  return (
    <form ref={formRef} className="intake surface" onSubmit={submit} noValidate>
      <StepIndicator
        steps={steps}
        current={step}
        onSelect={(index: number) => {
          setErrors({});
          setStep(index);
        }}
      />
      <p className="form-section-progress">{t("Step {current} of {total}", { current: step + 1, total: steps.length })}</p>
      <h2 className="form-section-title">{t(current.title)}</h2>
      <Tx as="p" className="form-section-text" text={current.description} />
      <div className="fields fields--two">
        {visibleFields(current.fields, values).map((field: FieldSchema) => (
          <FieldRenderer
            key={field.name}
            field={field}
            value={values[field.name]}
            error={errors[field.name]}
            formData={values}
            onChange={change}
          />
        ))}
      </div>
      {current.render?.()}
      {Object.keys(errors).some((k) => !current.fields.some((f) => f.name === k)) && (
        <p className="field__error" role="alert">
          {Object.entries(errors)
            .filter(([k]) => !current.fields.some((f) => f.name === k))
            .map(([, v]) => t(v))
            .join(" ")}
        </p>
      )}
      <div className="intake__footer">
        {step > 0 ? (
          <button type="button" className="btn btn--secondary" onClick={() => setStep(step - 1)}>
            <ChevronLeft size={16} aria-hidden="true" /> {t("Back")}
          </button>
        ) : (
          <span />
        )}
        <button type="submit" className="btn btn--primary">
          {last ? t(submitLabel) : t("Next")} <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </form>
  );
}
