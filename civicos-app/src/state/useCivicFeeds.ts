import { useEffect, useState } from "react";
import type { Disruption, DisruptionFeed, NewsItem, ProvinceCode } from "../types/dashboard";

const DISRUPTION_REFRESH_MS = 2 * 60 * 1000;
const NEWS_REFRESH_MS = 10 * 60 * 1000;
const OTTAWA_TRAFFIC_URL = "https://traffic.ottawa.ca/map/service/events?accept-language=en";

export type LoadState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "ready"; data: T; error: null }
  | { status: "error"; data: T | null; error: string };

interface Origin {
  lat: number;
  lon: number;
}

/**
 * Fallback for static hosting without the /api/feeds middleware: the City of
 * Ottawa traffic feed allows cross-origin requests, so road closures still work.
 */
async function fetchTrafficDirect(signal: AbortSignal): Promise<DisruptionFeed> {
  const response = await fetch(OTTAWA_TRAFFIC_URL, { signal });
  if (!response.ok) throw new Error(`Traffic feed ${response.status}`);
  const payload = (await response.json()) as { events?: Array<Record<string, string>> };
  const now = Date.now();
  const items: Disruption[] = (payload.events ?? []).flatMap((event) => {
    const window = /startDateTime': '([^']+)'.*endDateTime': '([^']+)'/.exec(event.schedule ?? "");
    if (window && (Date.parse(window[1]) > now || Date.parse(window[2]) < now)) return [];
    const incident = event.eventType === "INCIDENT";
    return [
      {
        id: `road-${event.id}`,
        kind: "road" as const,
        severity:
          incident && event.priority === "HIGH"
            ? ("critical" as const)
            : incident || event.priority === "HIGH"
              ? ("moderate" as const)
              : ("advisory" as const),
        title: `${incident ? "Incident" : "Construction"}: ${event.headline ?? event.mainStreet}`,
        detail: event.message ?? "",
        source: "City of Ottawa Traffic",
        sourceUrl: "https://traffic.ottawa.ca/",
      },
    ];
  });
  return {
    items,
    sources: [
      { kind: "road", label: "City of Ottawa road closures", status: "live", sourceUrl: "https://traffic.ottawa.ca/" },
      { kind: "power", label: "Hydro Ottawa outages", status: "unavailable", sourceUrl: "https://outages.hydroottawa.com/" },
      { kind: "transit", label: "OC Transpo service updates", status: "unavailable", sourceUrl: "https://www.octranspo.com/en/alerts" },
      { kind: "water", label: "Boil-water advisories", status: "no-feed", sourceUrl: "https://www.ottawapublichealth.ca/" },
    ],
    fetchedAt: new Date().toISOString(),
  };
}

export function useDisruptions(enabled: boolean, origin: Origin | null): LoadState<DisruptionFeed> & { refresh: () => void } {
  const [state, setState] = useState<LoadState<DisruptionFeed>>({ status: "loading", data: null, error: null });
  const [tick, setTick] = useState(0);
  const lat = origin?.lat;
  const lon = origin?.lon;

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    const params = lat !== undefined && lon !== undefined ? `?lat=${lat}&lon=${lon}` : "";

    const load = async () => {
      try {
        const response = await fetch(`/api/feeds/disruptions${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`Feed ${response.status}`);
        const feed = (await response.json()) as DisruptionFeed;
        setState({ status: "ready", data: feed, error: null });
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        try {
          setState({ status: "ready", data: await fetchTrafficDirect(controller.signal), error: null });
        } catch (fallbackError) {
          if ((fallbackError as Error).name === "AbortError") return;
          setState((prev) => ({ status: "error", data: prev.data, error: "Live disruption feeds are unavailable right now." }));
        }
      }
    };

    load();
    const timer = window.setInterval(load, DISRUPTION_REFRESH_MS);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [enabled, lat, lon, tick]);

  return { ...state, refresh: () => setTick((t) => t + 1) };
}

export interface NewsFeed {
  national: NewsItem[];
  provincial: NewsItem[];
  fetchedAt: string;
}

export function useNews(province: ProvinceCode): LoadState<NewsFeed> {
  const [state, setState] = useState<LoadState<NewsFeed>>({ status: "loading", data: null, error: null });

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch(`/api/feeds/news?province=${province}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`News ${response.status}`);
        setState({ status: "ready", data: (await response.json()) as NewsFeed, error: null });
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setState((prev) => ({ status: "error", data: prev.data, error: "Headlines are unavailable right now." }));
      }
    };
    load();
    const timer = window.setInterval(load, NEWS_REFRESH_MS);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [province]);

  return state;
}
