import { LOCALE_INFO, type Locale } from "./locales";

/**
 * Intl has no calendar data for Inuktitut or Anishinaabemowin, so their
 * weekday and month names are supplied here (draft, pending review).
 * Sunday first, matching Date#getDay().
 */
const WEEKDAYS: Partial<Record<Locale, string[]>> = {
  iu: ["ᓈᑦᑏᖑᔭᖅ", "ᓇᒡᒐᔾᔭᐅ", "ᐊᐃᑉᐱᖅ", "ᐱᖓᑦᓯᖅ", "ᓯᑕᒻᒥᖅ", "ᑕᓪᓕᕐᒥᖅ", "ᓯᕙᑖᕐᕕᒃ"],
  oj: [
    "Anami'e-giizhigad",
    "Ishkwaa-anami'e-giizhigad",
    "Niizho-giizhigad",
    "Aabitoose",
    "Niiyo-giizhigad",
    "Naano-giizhigad",
    "Giziibiigisaginige-giizhigad",
  ],
};

const MONTHS: Partial<Record<Locale, string[]>> = {
  iu: ["ᔮᓐᓄᐊᕆ", "ᕖᕝᕗᐊᕆ", "ᒫᑦᓯ", "ᐊᐃᕆᓪ", "ᒪᐃ", "ᔫᓂ", "ᔪᓚᐃ", "ᐊᐅᒡᒍᓯ", "ᓯᑎᐱᕆ", "ᐅᑐᐱᕆ", "ᓄᕕᐱᕆ", "ᑎᓯᐱᕆ"],
  oj: [
    "Manidoo-giizis",
    "Namebini-giizis",
    "Onaabani-giizis",
    "Iskigamizige-giizis",
    "Zaagibagaa-giizis",
    "Ode'imini-giizis",
    "Aabita-niibino-giizis",
    "Manoominike-giizis",
    "Waatebagaa-giizis",
    "Binaakwe-giizis",
    "Gashkadino-giizis",
    "Manidoo-giizisoons",
  ],
};

export type DateStyle =
  /** Saturday, September 26 */
  | "long"
  /** Sep 26 */
  | "short"
  /** Sat, Sep 26, 5:00 a.m. */
  | "dayTime"
  /** Saturday */
  | "weekday"
  /** 5:00 a.m. */
  | "time"
  /** September 26, 2026 */
  | "date";

const INTL_OPTIONS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  long: { weekday: "long", month: "long", day: "numeric" },
  short: { month: "short", day: "numeric" },
  dayTime: { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" },
  weekday: { weekday: "long" },
  time: { hour: "numeric", minute: "2-digit" },
  date: { year: "numeric", month: "long", day: "numeric" },
};

const formatters = new Map<string, Intl.DateTimeFormat>();
const intlFormat = (intl: string, style: DateStyle, date: Date) => {
  const key = `${intl}|${style}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(intl, INTL_OPTIONS[style]);
    formatters.set(key, formatter);
  }
  return formatter.format(date);
};

export function formatDate(locale: Locale, value: Date | string | number, style: DateStyle = "short"): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const weekdays = WEEKDAYS[locale];
  const months = MONTHS[locale];
  if (!weekdays || !months) return intlFormat(LOCALE_INFO[locale].intl, style, date);

  const weekday = weekdays[date.getDay()];
  const month = months[date.getMonth()];
  const time = intlFormat("en-CA", "time", date);
  switch (style) {
    case "long":
      return `${weekday}, ${month} ${date.getDate()}`;
    case "short":
      return `${month} ${date.getDate()}`;
    case "dayTime":
      return `${weekday}, ${month} ${date.getDate()}, ${time}`;
    case "weekday":
      return weekday;
    case "time":
      return time;
    case "date":
      return `${month} ${date.getDate()}, ${date.getFullYear()}`;
  }
}

/** "today 6:00 p.m." style relative day with clock time, translated through `t`. */
export function formatWhen(locale: Locale, t: (text: string, params?: Record<string, string>) => string, iso: string, now = new Date()): string {
  const date = new Date(iso);
  const dayOffset = Math.round(
    (new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
      86400000,
  );
  const time = formatDate(locale, date, "time");
  if (dayOffset === 0) return t("today {time}", { time });
  if (dayOffset === 1) return t("tomorrow {time}", { time });
  if (dayOffset === -1) return t("yesterday {time}", { time });
  return formatDate(locale, date, "dayTime");
}

/** "5 minutes ago" / "in 2 hours"; Intl for en/fr, English wording for draft locales. */
export function relativeTime(locale: Locale, iso: string | undefined, t: (text: string) => string, now = Date.now()): string {
  if (!iso) return "";
  const intl = locale === "fr" ? "fr-CA" : "en-CA";
  const rtf = new Intl.RelativeTimeFormat(intl, { numeric: "auto" });
  const diffSeconds = Math.round((Date.parse(iso) - now) / 1000);
  const abs = Math.abs(diffSeconds);
  if (abs < 60) return t("just now");
  if (abs < 3600) return rtf.format(Math.round(diffSeconds / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSeconds / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diffSeconds / 86400), "day");
  return formatDate(locale, iso, "short");
}
