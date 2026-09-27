/**
 * Smart auto-fill: maps a citizen's pasted text (a note, or text copied from a
 * lease, pay stub or bill) onto the active application form.
 *
 * Every value is validated against the field's schema before it is used:
 * choices must match an option, numbers and dates must parse, and the
 * wizard's normal validation still runs before the citizen can continue.
 */

import { callGeminiTask, GeminiError } from "./geminiClient";

/** Types the AI may fill. Confirmations, estimates and map widgets stay manual. */
const FILLABLE_TYPES = new Set(["text", "email", "tel", "number", "date", "textarea", "select", "radio", "checkbox-group"]);

/** Government identifiers are never sent to or filled by the AI; citizens type these themselves. */
export const SENSITIVE_FIELDS = new Set(["sin", "healthNumber", "passportNumber", "licenceNumber", "prestoNumber", "serviceNumber"]);

export const MAX_AUTOFILL_CHARS = 4000;

export const isAutoFillable = (field) => FILLABLE_TYPES.has(field.type) && !SENSITIVE_FIELDS.has(field.name);

const normalize = (value) => value.trim().toLowerCase();

const matchOption = (field, value) => {
  const wanted = normalize(value);
  return field.options?.find((o) => normalize(String(o.value)) === wanted || normalize(String(o.label)) === wanted)?.value;
};

const isValidISODate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
};

/** Converts one AI string into the value shape FieldRenderer expects, or undefined to skip it. */
function coerce(field, raw) {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  const value = raw.trim();

  switch (field.type) {
    case "select":
    case "radio":
      return matchOption(field, value);
    case "checkbox-group": {
      const picked = new Set(value.split(/[,;\n]/).map((part) => matchOption(field, part)));
      // Keep option order, as FieldRenderer does for manual picks.
      const ordered = field.options.map((o) => o.value).filter((v) => picked.has(v));
      return ordered.length ? ordered : undefined;
    }
    case "number": {
      const amount = Number(value.replace(/[$,\s]/g, ""));
      if (!Number.isFinite(amount) || (field.min !== undefined && amount < field.min) || (field.max !== undefined && amount > field.max)) {
        return undefined;
      }
      // Number inputs hold strings in formData, matching what the input's onChange produces.
      return String(field.step === 1 ? Math.round(amount) : amount);
    }
    case "date":
      return isValidISODate(value) ? value : undefined;
    default: {
      const text = value.slice(0, field.maxLength ?? (field.type === "textarea" ? 2000 : 200));
      return field.transform === "uppercase" ? text.toUpperCase() : text;
    }
  }
}

/**
 * @param {string} rawInputText  Unstructured text pasted by the citizen.
 * @param {Array<object>} formSchema  Field schemas from data/fieldBuilders.js (any steps).
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<{ values: Record<string, unknown>, filled: string[] }>}
 */
export async function extractFormDataFromTextOrDoc(rawInputText, formSchema, { signal } = {}) {
  const text = rawInputText.trim().slice(0, MAX_AUTOFILL_CHARS);
  if (!text) throw new GeminiError("Paste some text to auto-fill from.", "BAD_REQUEST");

  const fields = formSchema.filter(isAutoFillable);
  if (!fields.length) throw new GeminiError("This form has no fields that can be auto-filled.", "BAD_REQUEST");

  const payload = {
    text,
    fields: fields.map((field) => ({
      name: field.name,
      label: field.reviewLabel ?? field.label,
      type: field.type,
      hint: field.hint,
      options: field.options?.map((o) => ({ value: String(o.value), label: String(o.label) })),
    })),
  };
  const raw = await callGeminiTask("extract", payload, { signal });
  const extracted = raw.values && typeof raw.values === "object" ? raw.values : {};

  const values = {};
  for (const field of fields) {
    const value = coerce(field, extracted[field.name]);
    if (value !== undefined) values[field.name] = value;
  }
  return { values, filled: Object.keys(values) };
}
