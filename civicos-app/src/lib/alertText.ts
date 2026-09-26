import { formatWhen } from "./time";
import type { RegionalAlert } from "../types/alerts";

/** Plain-language timing: when it ends, when service should be back, or why there's no estimate. */
export function resolutionText(alert: RegionalAlert, now = new Date()): string {
  const { resolution, category, startsAt } = alert;
  if (resolution.kind === "ongoing" || !resolution.at) return resolution.note ?? "No estimate yet";

  const at = Date.parse(resolution.at);
  if (at < now.getTime()) return "Past its estimated time; awaiting an update";
  if (startsAt && Date.parse(startsAt) > now.getTime())
    return `Scheduled ${formatWhen(startsAt, now)} to ${formatWhen(resolution.at, now)}`;
  if (resolution.kind === "ends") return `Expected to end ${formatWhen(resolution.at, now)}`;
  if (category === "power" || category === "service-outage" || category === "maintenance")
    return `Estimated restoration ${formatWhen(resolution.at, now)}`;
  return `Expected back to normal ${formatWhen(resolution.at, now)}`;
}
