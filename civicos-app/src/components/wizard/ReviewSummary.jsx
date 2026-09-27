import { ListChecks, Pencil } from "lucide-react";
import { formatAnswer } from "../../lib/formatting";
import { visibleFields } from "../../lib/validation";
import { useLanguage } from "../../context/LanguageContext";

const ReviewGroup = ({ step, formData, onEdit }) => {
  const { currentLang, t } = useLanguage();
  const rows = visibleFields(step.fields, formData).filter((field) => field.type !== "info");
  return (
    <div className="review-group">
      <div className="review-group__header">
        {step.title}
        <button type="button" className="link-btn" onClick={onEdit}>
          <Pencil size={12} aria-hidden="true" /> {t("Edit", "Modifier")}
        </button>
      </div>
      <dl className="review-list">
        {rows.map((field) => (
          <div key={field.name}>
            <dt>{field.reviewLabel ?? field.label}</dt>
            <dd>{formatAnswer(field, formData[field.name], formData, currentLang)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
};

/** Step 3: every answer grouped by step, plus the documents checklist. */
const ReviewSummary = ({ steps, formData, requirements, onEdit }) => {
  const { t } = useLanguage();
  return (
    <>
      {steps.map((step, index) => (
        <ReviewGroup key={step.id} step={step} formData={formData} onEdit={() => onEdit(index)} />
      ))}
      {requirements.length > 0 && (
        <div className="review-group">
          <div className="review-group__header">
            <span className="review-group__title">
              <ListChecks size={14} aria-hidden="true" /> {t("Documents to have ready", "Documents à préparer")}
            </span>
          </div>
          <ul className="requirements-list">
            {requirements.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
};

export default ReviewSummary;
