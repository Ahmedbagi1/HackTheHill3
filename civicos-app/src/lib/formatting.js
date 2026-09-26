import { isEmptyValue } from "./validation";

export const currencyFormat = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
});

const dateFormat = new Intl.DateTimeFormat("en-CA", { dateStyle: "long" });

export const titleCase = (value) =>
  value.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/** Parses YYYY-MM-DD as a local date so the day doesn't shift across time zones. */
export const formatISODate = (value) => {
  const [year, month, day] = value.split("-").map(Number);
  return dateFormat.format(new Date(year, month - 1, day));
};

const optionLabel = (field, value) =>
  field.options.find((option) => option.value === value)?.label ?? value;

export const formatWasteSchedule = (schedule) =>
  `${titleCase(schedule.day)} · Schedule ${schedule.schedule} · ${schedule.address}`;

export const formatGeotag = (location) =>
  `${location.label ? `${location.label} ` : ""}(${location.lat.toFixed(5)}, ${location.lon.toFixed(5)})`;

/** Human-readable answer for the review step and the downloadable packet. */
export const formatAnswer = (field, value, formData) => {
  if (field.type === "estimate") {
    const result = field.compute(formData);
    return result ? [result.headline, result.subline].filter(Boolean).join(" — ") : "Not enough information";
  }

  if (isEmptyValue(field, value)) {
    if (field.type === "checkbox-group") return "None selected";
    if (field.type === "checkbox") return "Not confirmed";
    return "—";
  }

  switch (field.type) {
    case "select":
    case "radio":
      return optionLabel(field, value);
    case "checkbox-group":
      return value.map((v) => optionLabel(field, v)).join(", ");
    case "checkbox":
      return "Confirmed";
    case "number": {
      const amount = Number(value);
      if (field.prefix === "$") return currencyFormat.format(amount);
      return `${amount.toLocaleString("en-CA")}${field.suffix ? ` ${field.suffix}` : ""}`;
    }
    case "date":
      return formatISODate(value);
    case "waste-lookup":
      return formatWasteSchedule(value);
    case "geotag":
      return formatGeotag(value);
    default:
      return value.trim();
  }
};
