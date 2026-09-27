import { ListChecks, Pencil } from "lucide-react";
import { formatAnswer } from "../../lib/formatting";
import { visibleFields } from "../../lib/validation";
import { useI18n } from "../../i18n/i18nContext";
import { useAnswerLanguage } from "../../i18n/useAnswerLanguage";
import Tx from "../../i18n/Tx";

const ReviewGroup = ({ step, formData, onEdit }) => {
  const { t } = useI18n();
  const lang = useAnswerLanguage();
  const rows = visibleFields(step.fields, formData).filter((field) => field.type !== "info");
  return (
    <div className="review-group">
      <div className="review-group__header">
        {t(step.title)}
        <button type="button" className="link-btn" onClick={onEdit}>
          <Pencil size={12} aria-hidden="true" /> {t("Edit")}
        </button>
      </div>
      <dl className="review-list">
        {rows.map((field) => (
          <div key={field.name}>
            <Tx as="dt" text={field.reviewLabel ?? field.label} />
            <dd>{formatAnswer(field, formData[field.name], formData, lang)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
};

/** Step 3: every answer grouped by step, plus the documents checklist. */
const ReviewSummary = ({ steps, formData, requirements, onEdit }) => {
  const { t } = useI18n();
  return (
    <>
      {steps.map((step, index) => (
        <ReviewGroup key={step.id} step={step} formData={formData} onEdit={() => onEdit(index)} />
      ))}
      {requirements.length > 0 && (
        <div className="review-group">
          <div className="review-group__header">
            <span className="review-group__title">
              <ListChecks size={14} aria-hidden="true" /> {t("Documents to have ready")}
            </span>
          </div>
          <ul className="requirements-list">
            {requirements.map((item) => (
              <Tx key={item} as="li" text={item} />
            ))}
          </ul>
        </div>
      )}
    </>
  );
};

export default ReviewSummary;
