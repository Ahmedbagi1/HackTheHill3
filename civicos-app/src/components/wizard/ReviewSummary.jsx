import { ListChecks, Pencil } from "lucide-react";
import { formatAnswer } from "../../lib/formatting";
import { visibleFields } from "../../lib/validation";

const ReviewGroup = ({ step, formData, onEdit }) => {
  const rows = visibleFields(step.fields, formData).filter((field) => field.type !== "info");
  return (
    <div className="review-group">
      <div className="review-group__header">
        {step.title}
        {onEdit && <button type="button" className="link-btn" onClick={onEdit}>
          <Pencil size={12} aria-hidden="true" /> Edit
        </button>}
      </div>
      <dl className="review-list">
        {rows.map((field) => (
          <div key={field.name}>
            <dt>{field.reviewLabel ?? field.label}</dt>
            <dd>{formatAnswer(field, formData[field.name], formData)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
};

/** Step 3: every answer grouped by step, plus the documents checklist. */
const ReviewSummary = ({ steps, formData, requirements, onEdit }) => (
  <>
    {steps.map((step, index) => (
      <ReviewGroup key={step.id} step={step} formData={formData} onEdit={onEdit ? () => onEdit(index) : undefined} />
    ))}
    {requirements.length > 0 && (
      <div className="review-group">
        <div className="review-group__header">
          <span className="review-group__title">
            <ListChecks size={14} aria-hidden="true" /> Documents to have ready
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

export default ReviewSummary;
