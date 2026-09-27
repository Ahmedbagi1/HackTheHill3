import { isEmptyValue } from "./validation";

/**
 * Optional language for formatted answers:
 *   { t(text, params?), intl: "fr-CA", formatDate(isoDate) }
 * Without it, answers are formatted in Canadian English (used for the stored
 * request summary, which is translated again at display time).
 *
 * @typedef {{ t: (text: string, params?: Record<string, string | number>) => string, intl: string, formatDate: (isoDate: string) => string }} AnswerLanguage
 */

const ENGLISH = {
  t: (text, params) => (params ? text.replace(/\{(\w+)\}/g, (m, k) => (params[k] ?? m)) : text),
  intl: "en-CA",
  formatDate: null,
};

const englishDate = new Intl.DateTimeFormat("en-CA", { dateStyle: "long" });

export const currencyFormat = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
});

export const titleCase = (value) => value.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/** Parses YYYY-MM-DD as a local date so the day doesn't shift across time zones. */
export const formatISODate = (value, lang = ENGLISH) => {
  if (lang.formatDate) return lang.formatDate(value);
  const [year, month, day] = value.split("-").map(Number);
  return englishDate.format(new Date(year, month - 1, day));
};

const optionLabel = (field, value) => field.options.find((option) => option.value === value)?.label ?? value;

/** @param {AnswerLanguage} [lang] */
export const formatWasteSchedule = (schedule, lang = ENGLISH) =>
  `${lang.t(titleCase(schedule.day))} · ${lang.t("Schedule {schedule}", { schedule: schedule.schedule })} · ${schedule.address}`;

export const formatGeotag = (location) =>
  `${location.label ? `${location.label} ` : ""}(${location.lat.toFixed(5)}, ${location.lon.toFixed(5)})`;

/**
 * Human-readable answer for the review step, the downloadable packet and the
 * request summary.
 * @param {AnswerLanguage} [lang]
 */
export const formatAnswer = (field, value, formData, lang = ENGLISH) => {
  const { t } = lang;

  if (field.type === "estimate") {
    const result = field.compute(formData);
    return result ? [t(result.headline), result.subline && t(result.subline)].filter(Boolean).join(" — ") : t("Not enough information");
  }

  if (isEmptyValue(field, value)) {
    if (field.type === "checkbox-group") return t("None selected");
    if (field.type === "checkbox") return t("Not confirmed");
    return "—";
  }

  switch (field.type) {
    case "select":
    case "radio":
      return t(optionLabel(field, value));
    case "checkbox-group":
      return value.map((v) => t(optionLabel(field, v))).join(", ");
    case "checkbox":
      return t("Confirmed");
    case "number": {
      const amount = Number(value);
      if (field.prefix === "$") return new Intl.NumberFormat(lang.intl, { style: "currency", currency: "CAD" }).format(amount);
      return `${amount.toLocaleString(lang.intl)}${field.suffix ? ` ${t(field.suffix)}` : ""}`;
    }
    case "date":
      return formatISODate(value, lang);
    case "waste-lookup":
      return formatWasteSchedule(value, lang);
    case "geotag":
      return formatGeotag(value);
    default:
      return value.trim();
  }
};
