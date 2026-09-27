import { byLang, INTL_LOCALES, type Lang } from "./i18n";

export interface Formatters {
  /** Whole dollars: "$1,234" · "1 234 $". */
  currency(amount: number): string;
  /** Dollars and cents: "$1,234.56" · "1 234,56 $". */
  currencyCents(amount: number): string;
  number(value: number): string;
  /** ISO timestamp → "Sep 26" · "26 sept.". */
  shortDate(iso: string | undefined): string;
  /** YYYY-MM-DD → "September 26, 2026" · "26 septembre 2026". */
  longDate(isoDate: string): string;
  /** YYYY-MM-DD → "Saturday, September 26" · "samedi 26 septembre". */
  weekdayDate(isoDate: string): string;
  /** YYYY-MM-DD → "September 26" · "26 septembre". */
  monthDay(isoDate: string): string;
  /** "2026-01" → "January 2026" · "janvier 2026". */
  monthYear(isoMonth: string): string;
  /** Today's date for the dashboard hero. */
  today(date?: Date): string;
  dateTime(date: Date): string;
  relativeTime(iso: string | undefined, now?: number): string;
  /** Weekday from an upper-case English name ("MONDAY") → "Monday" · "lundi". */
  weekday(name: string): string;
}

const WEEKDAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

/** Parses YYYY-MM-DD as a local date so the day doesn't shift across time zones. */
export const parseLocalDate = (isoDate: string) => {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day || 1);
};

export const capitalize = (value: string) => value.charAt(0).toLocaleUpperCase() + value.slice(1);

export const getFormatters = byLang((t, lang: Lang): Formatters => {
  const locale = INTL_LOCALES[lang];
  const currency = new Intl.NumberFormat(locale, { style: "currency", currency: "CAD", maximumFractionDigits: 0 });
  const currencyCents = new Intl.NumberFormat(locale, { style: "currency", currency: "CAD" });
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const short = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });
  const long = new Intl.DateTimeFormat(locale, { dateStyle: "long" });
  const weekdayDate = new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric" });
  const monthDay = new Intl.DateTimeFormat(locale, { month: "long", day: "numeric" });
  const monthYear = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" });
  const dateTime = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short" });
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "long" });
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  return {
    currency: (amount) => currency.format(amount),
    currencyCents: (amount) => currencyCents.format(amount),
    number: (value) => number.format(value),
    shortDate: (iso) => (iso ? short.format(new Date(iso)) : ""),
    longDate: (isoDate) => long.format(parseLocalDate(isoDate)),
    weekdayDate: (isoDate) => weekdayDate.format(parseLocalDate(isoDate)),
    monthDay: (isoDate) => monthDay.format(parseLocalDate(isoDate)),
    monthYear: (isoMonth) => monthYear.format(parseLocalDate(isoMonth)),
    today: (date = new Date()) => weekdayDate.format(date),
    dateTime: (date) => dateTime.format(date),
    relativeTime(iso, now = Date.now()) {
      if (!iso) return "";
      const diffSeconds = Math.round((Date.parse(iso) - now) / 1000);
      const abs = Math.abs(diffSeconds);
      if (abs < 60) return t("just now", "à l'instant");
      if (abs < 3600) return relative.format(Math.round(diffSeconds / 60), "minute");
      if (abs < 86400) return relative.format(Math.round(diffSeconds / 3600), "hour");
      if (abs < 86400 * 30) return relative.format(Math.round(diffSeconds / 86400), "day");
      return short.format(new Date(iso));
    },
    weekday(name) {
      const index = WEEKDAYS.indexOf(name.toUpperCase());
      // 2023-01-01 was a Sunday.
      return index < 0 ? name : weekday.format(new Date(2023, 0, 1 + index));
    },
  };
});
