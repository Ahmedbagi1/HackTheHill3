/**
 * Dashboard summaries for submitted catalog requests. The raw answers are
 * stored; labels and formatted values are rebuilt in the active language.
 */

import { buildSteps } from "../data/servicesData";
import { formatAnswer } from "./formatting";
import { DISPLAY_ONLY_TYPES, isEmptyValue, visibleFields } from "./validation";

/** Raw values of the first few answered questions, in form order. */
export const pickSummaryAnswers = (steps, formData, limit = 3) =>
  Object.fromEntries(
    steps
      .flatMap((step) => visibleFields(step.fields, formData))
      .filter((field) => !DISPLAY_ONLY_TYPES.has(field.type) && !isEmptyValue(field, formData[field.name]))
      .slice(0, limit)
      .map((field) => [field.name, formData[field.name]]),
  );

/** [{ label, value }] for stored answers, worded in `lang`. */
export const describeAnswers = (service, answers, lang) => {
  const fields = buildSteps(service.form, lang).flatMap((step) => step.fields);
  return Object.entries(answers).flatMap(([name, value]) => {
    const field = fields.find((candidate) => candidate.name === name);
    return field ? [{ label: field.reviewLabel ?? field.label, value: formatAnswer(field, value, answers, lang) }] : [];
  });
};
