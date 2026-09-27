/**
 * Schema-driven validation for wizard fields.
 * See data/fieldBuilders.js for the field schema reference.
 */

/** Types that render content but hold no user answer. */
export const DISPLAY_ONLY_TYPES = new Set(["info", "estimate"]);

const CHOICE_TYPES = new Set(["select", "radio"]);

export const todayISO = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
};

export const emptyValueFor = (field) => {
  switch (field.type) {
    case "checkbox-group":
      return [];
    case "checkbox":
      return false;
    case "waste-lookup":
    case "geotag":
      return null;
    default:
      return "";
  }
};

export const isVisible = (field, formData) => !field.showIf || field.showIf(formData);

export const visibleFields = (fields, formData) =>
  fields.filter((field) => isVisible(field, formData));

export const isEmptyValue = (field, value) => {
  if (value === null || value === undefined) return true;
  if (field.type === "checkbox-group") return value.length === 0;
  if (field.type === "checkbox") return !value;
  if (typeof value === "string") return value.trim() === "";
  return false;
};

const withUnits = (field, amount) =>
  `${field.prefix ?? ""}${amount}${field.suffix ? ` ${field.suffix}` : ""}`;

export const validateField = (field, value, formData) => {
  if (DISPLAY_ONLY_TYPES.has(field.type)) return null;

  if (isEmptyValue(field, value)) {
    if (field.optional) return null;
    if (field.requiredMessage) return field.requiredMessage;
    return CHOICE_TYPES.has(field.type) ? "Please choose an option." : `${field.label} is required.`;
  }

  if (typeof value === "string") {
    const text = value.trim();

    if (field.pattern && !field.pattern.regex.test(text)) return field.pattern.message;

    if (field.type === "number") {
      const amount = Number(text);
      if (!Number.isFinite(amount)) return "Enter a valid number.";
      if (field.min !== undefined && amount < field.min)
        return `Must be at least ${withUnits(field, field.min)}.`;
      if (field.max !== undefined && amount > field.max)
        return `Must be ${withUnits(field, field.max)} or less.`;
      if (field.step === 1 && !Number.isInteger(amount)) return "Enter a whole number.";
    }

    if (field.type === "date") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "Enter a valid date.";
      if (field.notAfterToday && text > todayISO()) return "Date can't be in the future.";
      if (field.notBeforeToday && text < todayISO()) return "Date can't be in the past.";
    }
  }

  return field.validate ? field.validate(value, formData) : null;
};

export const validateFields = (fields, formData) => {
  const errors = {};
  for (const field of visibleFields(fields, formData)) {
    const error = validateField(field, formData[field.name], formData);
    if (error) errors[field.name] = error;
  }
  return errors;
};

export const buildInitialFormData = (form) => {
  const data = { consent: false };
  for (const field of [form.primary, form.applicant, form.verification].filter(Boolean).flatMap((section) => section.fields)) {
    if (!DISPLAY_ONLY_TYPES.has(field.type)) data[field.name] = emptyValueFor(field);
  }
  return data;
};
