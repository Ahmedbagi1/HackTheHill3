const rtf = new Intl.RelativeTimeFormat("en-CA", { numeric: "auto" });
const dateFormat = new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric" });
const longDateFormat = new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric" });

export function relativeTime(iso: string | undefined, now = Date.now()): string {
  if (!iso) return "";
  const diffSeconds = Math.round((Date.parse(iso) - now) / 1000);
  const abs = Math.abs(diffSeconds);
  if (abs < 60) return "just now";
  if (abs < 3600) return rtf.format(Math.round(diffSeconds / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSeconds / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diffSeconds / 86400), "day");
  return dateFormat.format(new Date(iso));
}

export const shortDate = (iso: string | undefined) => (iso ? dateFormat.format(new Date(iso)) : "");

/** Formats a YYYY-MM-DD date as a local calendar date. */
export function longLocalDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return longDateFormat.format(new Date(y, m - 1, d));
}

export function greeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export const cad = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });
