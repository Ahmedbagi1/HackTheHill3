import { capitalize, getFormatters } from "../i18n/format";
import { tr } from "../i18n/i18n";
import { isEmptyValue } from "./validation";

const optionLabel = (field, value) =>
  field.options.find((option) => option.value === value)?.label ?? value;

/** City of Ottawa collection zones as published in the open data layer. */
const ZONES = { central: ["Central", "Centre"], east: ["East", "Est"], west: ["West", "Ouest"] };

export const zoneLabel = (zone, lang) => {
  const names = ZONES[String(zone ?? "").toLowerCase()];
  return names ? tr(lang)(names[0], names[1]) : zone;
};

/** "MONDAY" → "Monday" / "Lundi", for labels that stand on their own. */
export const collectionDay = (day, lang) => capitalize(getFormatters(lang).weekday(day));

export const formatWasteSchedule = (schedule, lang) => {
  const t = tr(lang);
  return `${collectionDay(schedule.day, lang)} · ${t("Schedule", "Horaire")} ${schedule.schedule} · ${schedule.address}`;
};

export const formatGeotag = (location) =>
  `${location.label ? `${location.label} ` : ""}(${location.lat.toFixed(5)}, ${location.lon.toFixed(5)})`;

/** Human-readable answer for the review step, the request summary and the downloadable packet. */
export const formatAnswer = (field, value, formData, lang = "en") => {
  const t = tr(lang);
  const fmt = getFormatters(lang);

  if (field.type === "estimate") {
    const result = field.compute(formData);
    return result
      ? [result.headline, result.subline].filter(Boolean).join(" — ")
      : t("Not enough information", "Renseignements insuffisants");
  }

  if (isEmptyValue(field, value)) {
    if (field.type === "checkbox-group") return t("None selected", "Aucune sélection");
    if (field.type === "checkbox") return t("Not confirmed", "Non confirmé");
    return "—";
  }

  switch (field.type) {
    case "select":
    case "radio":
      return optionLabel(field, value);
    case "checkbox-group":
      return value.map((v) => optionLabel(field, v)).join(", ");
    case "checkbox":
      return t("Confirmed", "Confirmé");
    case "number": {
      const amount = Number(value);
      if (field.currency) return fmt.currencyCents(amount);
      return `${fmt.number(amount)}${field.suffix ? ` ${field.suffix}` : ""}`;
    }
    case "date":
      return fmt.longDate(value);
    case "waste-lookup":
      return formatWasteSchedule(value, lang);
    case "geotag":
      return formatGeotag(value);
    default:
      return value.trim();
  }
};
