import { CircleAlert, Info } from "lucide-react";
import { todayISO } from "../../lib/validation";
import EstimateCard from "./EstimateCard";
import GeotagField from "./GeotagField";
import WasteLookupField from "./WasteLookupField";

const FieldError = ({ id, message }) =>
  message ? (
    <span id={id} className="field__error" role="alert">
      <CircleAlert size={13} aria-hidden="true" />
      {message}
    </span>
  ) : null;

const FieldHint = ({ id, text }) =>
  text ? (
    <span id={id} className="field__hint">
      {text}
    </span>
  ) : null;

const OptionalTag = ({ field }) =>
  field.optional ? <span className="field__optional"> (optional)</span> : null;

const applyTransform = (field, value) => (field.transform === "uppercase" ? value.toUpperCase() : value);

/** Renders any field type defined in data/fieldBuilders.js. */
const FieldRenderer = ({ field, value, error, formData, onChange }) => {
  const id = `field-${field.name}`;
  const hintId = field.hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  const fieldClass = `field${field.full ? " field--full" : ""}${error ? " field--error" : ""}`;

  /* Display-only ------------------------------------------------------ */

  if (field.type === "info") {
    return (
      <p className="field field--full callout">
        <Info size={16} aria-hidden="true" />
        {field.label}
      </p>
    );
  }

  if (field.type === "estimate") {
    return (
      <div className="field field--full">
        <EstimateCard label={field.label} result={field.compute(formData)} />
      </div>
    );
  }

  /* Composite widgets ------------------------------------------------- */

  if (field.type === "waste-lookup" || field.type === "geotag") {
    const Widget = field.type === "waste-lookup" ? WasteLookupField : GeotagField;
    return (
      <div className={fieldClass}>
        <label htmlFor={id} className="field__label">
          {field.label}
          <OptionalTag field={field} />
        </label>
        <Widget
          id={id}
          value={value}
          invalid={Boolean(error)}
          describedBy={describedBy}
          onChange={(next) => onChange(field.name, next)}
        />
        <FieldHint id={hintId} text={field.hint} />
        <FieldError id={errorId} message={error} />
      </div>
    );
  }

  /* Single declaration checkbox --------------------------------------- */

  if (field.type === "checkbox") {
    return (
      <div className={fieldClass}>
        <label className={`checkbox${error ? " checkbox--error" : ""}`}>
          <input
            type="checkbox"
            name={field.name}
            checked={value}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            onChange={(e) => onChange(field.name, e.target.checked)}
          />
          <span>{field.label}</span>
        </label>
        <FieldHint id={hintId} text={field.hint} />
        <FieldError id={errorId} message={error} />
      </div>
    );
  }

  /* Radio / checkbox choice cards ------------------------------------- */

  if (field.type === "radio" || field.type === "checkbox-group") {
    const isMulti = field.type === "checkbox-group";
    const toggle = (optionValue, checked) => {
      if (!isMulti) return onChange(field.name, optionValue);
      const selected = new Set(value);
      if (checked) selected.add(optionValue);
      else selected.delete(optionValue);
      // Keep answers in option order regardless of click order.
      onChange(field.name, field.options.map((o) => o.value).filter((v) => selected.has(v)));
    };

    return (
      <fieldset className={fieldClass} aria-describedby={describedBy} aria-invalid={Boolean(error)}>
        <legend className="field__label">
          {field.label}
          <OptionalTag field={field} />
        </legend>
        <div className="choice-group">
          {field.options.map((option) => {
            const checked = isMulti ? value.includes(option.value) : value === option.value;
            return (
              <label key={option.value} className={`choice${checked ? " choice--selected" : ""}`}>
                <input
                  type={isMulti ? "checkbox" : "radio"}
                  className="choice__input"
                  name={field.name}
                  value={option.value}
                  checked={checked}
                  onChange={(e) => toggle(option.value, e.target.checked)}
                />
                <span className="choice__text">
                  <span className="choice__label">{option.label}</span>
                  {option.hint && <span className="choice__hint">{option.hint}</span>}
                </span>
              </label>
            );
          })}
        </div>
        <FieldHint id={hintId} text={field.hint} />
        <FieldError id={errorId} message={error} />
      </fieldset>
    );
  }

  /* Text-like inputs, textarea, select -------------------------------- */

  const commonProps = {
    id,
    name: field.name,
    value,
    "aria-invalid": Boolean(error),
    "aria-required": !field.optional,
    "aria-describedby": describedBy,
  };

  let control;
  if (field.type === "select") {
    control = (
      <select
        {...commonProps}
        className="field__input field__select"
        required={!field.optional}
        onChange={(e) => onChange(field.name, e.target.value)}
      >
        <option value="" disabled>
          Select an option
        </option>
        {field.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  } else if (field.type === "textarea") {
    control = (
      <>
        <textarea
          {...commonProps}
          className="field__input field__textarea"
          rows={field.rows}
          maxLength={field.maxLength}
          placeholder={field.placeholder}
          onChange={(e) => onChange(field.name, e.target.value)}
        />
        {field.maxLength && (
          <span className="field__counter" aria-hidden="true">
            {value.length}/{field.maxLength}
          </span>
        )}
      </>
    );
  } else {
    const listId = field.suggestions ? `${id}-suggestions` : undefined;
    const inputClass = [
      "field__input",
      field.prefix && "field__input--has-prefix",
      field.suffix && "field__input--has-suffix",
    ]
      .filter(Boolean)
      .join(" ");

    const isDate = field.type === "date";
    control = (
      <>
        <div className="input-group">
          {field.prefix && (
            <span className="input-group__affix input-group__affix--prefix" aria-hidden="true">
              {field.prefix}
            </span>
          )}
          <input
            {...commonProps}
            type={field.type}
            className={inputClass}
            placeholder={field.placeholder}
            autoComplete={field.autoComplete}
            inputMode={field.inputMode}
            maxLength={field.maxLength}
            min={isDate ? (field.notBeforeToday ? todayISO() : undefined) : field.min}
            max={isDate ? (field.notAfterToday ? todayISO() : undefined) : field.max}
            step={field.step}
            list={listId}
            onChange={(e) => onChange(field.name, applyTransform(field, e.target.value))}
          />
          {field.suffix && (
            <span className="input-group__affix input-group__affix--suffix" aria-hidden="true">
              {field.suffix}
            </span>
          )}
        </div>
        {listId && (
          <datalist id={listId}>
            {field.suggestions.map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>
        )}
      </>
    );
  }

  return (
    <div className={fieldClass}>
      <label htmlFor={id} className="field__label">
        {field.label}
        {field.prefix === "$" && <span className="sr-only"> (in dollars)</span>}
        {field.suffix && <span className="sr-only"> (in {field.suffix})</span>}
        <OptionalTag field={field} />
      </label>
      {control}
      <FieldHint id={hintId} text={field.hint} />
      <FieldError id={errorId} message={error} />
    </div>
  );
};

export default FieldRenderer;
