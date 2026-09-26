import { useEffect, useState } from "react";
import {
  DRIVEBC_EVENTS_URL,
  DRIVEBC_PUBLIC_URL,
  ECCC_ALERTS_URL,
  ECCC_PUBLIC_URL,
  mapDriveBcEvents,
  mapEcccAlerts,
  sortAlerts,
} from "../lib/alertSources";
import type { AlertSource, RegionalAlertFeed } from "../types/alerts";
import type { LoadState } from "./useCivicFeeds";

const REFRESH_MS = 3 * 60 * 1000;

const ALL: AlertSource["coverage"] = ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"];

/**
 * Fallback for static hosting without the /api/feeds middleware. ECCC and
 * DriveBC send CORS headers, so weather and BC road alerts still load; the
 * utility outage feeds need the server.
 */
async function fetchDirect(signal: AbortSignal): Promise<RegionalAlertFeed> {
  const load = async (url: string) => {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`${url} ${response.status}`);
    return response.json() as Promise<unknown>;
  };
  const [eccc, drivebc] = await Promise.allSettled([load(ECCC_ALERTS_URL), load(DRIVEBC_EVENTS_URL)]);
  if (eccc.status === "rejected" && drivebc.status === "rejected") throw eccc.reason;

  const status = (r: PromiseSettledResult<unknown>) =>
    (r.status === "fulfilled" ? "live" : "unavailable") as AlertSource["status"];
  return {
    items: sortAlerts([
      ...(eccc.status === "fulfilled" ? mapEcccAlerts(eccc.value) : []),
      ...(drivebc.status === "fulfilled" ? mapDriveBcEvents(drivebc.value) : []),
    ]),
    sources: [
      { id: "eccc", label: "Environment Canada weather alerts", coverage: ALL, status: status(eccc), sourceUrl: ECCC_PUBLIC_URL },
      { id: "drivebc", label: "DriveBC road events", coverage: ["BC"], status: status(drivebc), sourceUrl: DRIVEBC_PUBLIC_URL },
    ],
    fetchedAt: new Date().toISOString(),
  };
}

/** Pan-Canadian alerts for every jurisdiction; the panel filters by region client-side. */
export function useRegionalAlerts(): LoadState<RegionalAlertFeed> & { refresh: () => void } {
  const [state, setState] = useState<LoadState<RegionalAlertFeed>>({ status: "loading", data: null, error: null });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch("/api/feeds/alerts", { signal: controller.signal });
        if (!response.ok) throw new Error(`Alerts ${response.status}`);
        setState({ status: "ready", data: (await response.json()) as RegionalAlertFeed, error: null });
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        try {
          setState({ status: "ready", data: await fetchDirect(controller.signal), error: null });
        } catch (fallbackError) {
          if ((fallbackError as Error).name === "AbortError") return;
          setState((prev) => ({ status: "error", data: prev.data, error: "Alerts across Canada are unavailable right now." }));
        }
      }
    };

    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [tick]);

  return { ...state, refresh: () => setTick((t) => t + 1) };
}
