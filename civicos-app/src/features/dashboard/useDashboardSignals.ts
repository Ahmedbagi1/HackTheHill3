import { useMemo } from "react";
import type { DashboardNotification, DisruptionFeed, EmergencyNotice, UserRequest } from "../../types/dashboard";
import type { WasteState } from "../../state/wasteSchedule";
import { daysUntil } from "../../state/wasteSchedule";

const STREAM_NAMES: Record<string, string> = {
  green: "green bin",
  garbage: "garbage",
  blue: "blue bin",
  black: "black bin",
  yard: "leaf & yard waste",
};

/**
 * Derives the notification list and any emergency banner from requests, the
 * waste schedule and live disruptions. Nothing here is invented: every
 * notification points at data the dashboard already shows.
 */
export function useDashboardSignals(requests: UserRequest[], waste: WasteState, disruptions: DisruptionFeed | null) {
  return useMemo(() => {
    const notifications: DashboardNotification[] = [];

    for (const request of requests) {
      if (request.actionRequired) {
        notifications.push({
          id: `action:${request.id}:${request.actionRequired.label}:${request.actionRequired.detail}`,
          tone: "moderate",
          title: request.actionRequired.label,
          detail: `${request.title}: ${request.actionRequired.detail}`,
          actionLabel: "Open",
          target: { type: "request", id: request.id },
        });
      }
    }

    if (waste.status === "ready") {
      const next = waste.schedule.upcoming[0];
      const days = daysUntil(next.date);
      if (days <= 1) {
        notifications.push({
          id: `waste:${next.date}`,
          tone: "info",
          title: days === 0 ? "Collection day is today" : "Tomorrow is collection day",
          detail: next.streams.map((s) => STREAM_NAMES[s]).join(", "),
          target: { type: "anchor", id: "waste" },
        });
      }
    }

    const critical = disruptions?.items.filter((i) => i.severity === "critical") ?? [];
    for (const item of critical.slice(0, 3)) {
      notifications.push({
        id: `disruption:${item.id}`,
        tone: "critical",
        title: item.title,
        detail: item.detail.slice(0, 120),
        target: { type: "anchor", id: "disruptions" },
      });
    }

    // Emergency banner only for city-wide essentials (power, water), not road work.
    const emergencyItem = critical.find((i) => i.kind === "power" || i.kind === "water");
    const emergency: EmergencyNotice | null = emergencyItem
      ? {
          id: `emergency:${emergencyItem.id}:${emergencyItem.title}`,
          severity: "critical",
          title: emergencyItem.title,
          text: emergencyItem.detail,
          sourceUrl: emergencyItem.sourceUrl,
        }
      : null;

    return { notifications, emergency };
  }, [requests, waste, disruptions]);
}
