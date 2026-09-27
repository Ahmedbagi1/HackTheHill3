import type { RegionalAlert } from "../types/alerts";

type Translate = (text: string, params?: Record<string, string | number>) => string;

/** Plain-language timing: when it ends, when service should be back, or why there's no estimate. */
export function resolutionText(alert: RegionalAlert, t: Translate, formatWhen: (iso: string) => string, now = new Date()): string {
  const { resolution, category, startsAt } = alert;
  if (resolution.kind === "ongoing" || !resolution.at) return t(resolution.note ?? "No estimate yet");

  const at = Date.parse(resolution.at);
  if (at < now.getTime()) return t("Past its estimated time; awaiting an update");
  if (startsAt && Date.parse(startsAt) > now.getTime()) return t("Scheduled {start} to {end}", { start: formatWhen(startsAt), end: formatWhen(resolution.at) });
  if (resolution.kind === "ends") return t("Expected to end {time}", { time: formatWhen(resolution.at) });
  if (category === "power" || category === "service-outage" || category === "maintenance")
    return t("Estimated restoration {time}", { time: formatWhen(resolution.at) });
  return t("Expected back to normal {time}", { time: formatWhen(resolution.at) });
}
