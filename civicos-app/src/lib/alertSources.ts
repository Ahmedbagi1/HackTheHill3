/**
 * Maps public disruption feeds from across Canada to the RegionalAlert shape.
 * Shared by the /api/feeds/alerts middleware (server/civicFeedsProxy.js) and
 * the browser fallback in state/useRegionalAlerts.ts, so both classify alike.
 *
 * Sources (all keyless, verified September 2026):
 *  - Environment and Climate Change Canada weather alerts (OGC API, all 13 jurisdictions)
 *  - DriveBC Open511 road events (BC)
 *  - Hydro-Québec outage markers (QC), which distinguish planned maintenance
 *  - BC Hydro outage list (BC)
 */
import type { ProvinceCode, Severity } from "../types/dashboard.ts";
import type { AlertResolution, RegionalAlert } from "../types/alerts.ts";

export const ECCC_ALERTS_URL = "https://api.weather.gc.ca/collections/weather-alerts/items?f=json&lang=en&limit=1000";
export const ECCC_PUBLIC_URL = "https://weather.gc.ca/?layers=alert";
export const DRIVEBC_EVENTS_URL = "https://api.open511.gov.bc.ca/events?format=json&status=ACTIVE&severity=MAJOR&limit=500";
export const DRIVEBC_PUBLIC_URL = "https://www.drivebc.ca/";
export const HYDRO_QUEBEC_VERSION_URL = "https://pannes.hydroquebec.com/pannes/donnees/v3_0/bisversion.json";
export const HYDRO_QUEBEC_MARKERS_URL = (version: string) =>
  `https://pannes.hydroquebec.com/pannes/donnees/v3_0/bismarkers${version}.json`;
export const HYDRO_QUEBEC_PUBLIC_URL = "https://pannes.hydroquebec.com/pannes/?lang=en";
export const BC_HYDRO_OUTAGES_URL = "https://www.bchydro.com/power-outages/app/outages-map-data.json";
export const BC_HYDRO_PUBLIC_URL = "https://www.bchydro.com/power-outages/app/outage-map.html";

const PROVINCE_CODES = new Set<ProvinceCode>(["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"]);

export const SEVERITY_RANK: Record<Severity, number> = { critical: 0, moderate: 1, advisory: 2 };

/** Severity for a power outage by customers affected; same thresholds as Hydro Ottawa. */
export const powerSeverity = (customers: number): Severity =>
  customers >= 1000 ? "critical" : customers >= 100 ? "moderate" : "advisory";

const sentenceCase = (text: string) => (text ? text[0].toUpperCase() + text.slice(1) : text);

const clip = (text: string, max = 220) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

const validIso = (value: unknown): string | undefined => {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

/** Converts a wall-clock time in `timeZone` (e.g. "2026-09-26 18:00:00") to ISO. */
export function zonedToIso(local: string, timeZone: string): string | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(local);
  if (!m) return undefined;
  const asUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(asUtc));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const zoned = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return new Date(asUtc - (zoned - asUtc)).toISOString();
}

export function sortAlerts(items: RegionalAlert[]): RegionalAlert[] {
  return [...items].sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      Date.parse(b.updatedAt ?? "1970-01-01") - Date.parse(a.updatedAt ?? "1970-01-01"),
  );
}

/* ------------------------------------------------------------------ */
/* Environment and Climate Change Canada                               */
/* ------------------------------------------------------------------ */

interface EcccProperties {
  alert_code?: string;
  alert_type?: string;
  alert_name_en?: string;
  alert_name_fr?: string;
  alert_text_en?: string;
  alert_text_fr?: string;
  feature_name_fr?: string;
  publication_datetime?: string;
  expiration_datetime?: string;
  event_end_datetime?: string;
  risk_colour_en?: string;
  feature_name_en?: string;
  feature_id?: string;
  province?: string;
  status_en?: string;
}

function ecccSeverity(p: EcccProperties): Severity {
  if (p.alert_type === "warning") return p.risk_colour_en === "red" || p.risk_colour_en === "orange" ? "critical" : "moderate";
  if (p.alert_type === "watch") return "moderate";
  return "advisory";
}

/**
 * ECCC publishes one feature per forecast zone, so a single rainfall warning
 * can arrive as ten features. Group them into one alert per event.
 */
export function mapEcccAlerts(payload: unknown, now = Date.now()): RegionalAlert[] {
  const features = ((payload as { features?: Array<{ properties?: EcccProperties }> })?.features ?? []).map(
    (f) => f.properties ?? {},
  );
  const groups = new Map<string, { props: EcccProperties; areas: string[]; areasFr: string[] }>();

  for (const p of features) {
    const province = p.province as ProvinceCode;
    if (!PROVINCE_CODES.has(province) || !p.alert_code) continue;
    if (p.status_en === "ended" || p.status_en === "cancelled") continue;
    if (p.expiration_datetime && Date.parse(p.expiration_datetime) < now) continue;

    const key = `${province}|${p.alert_code}|${p.alert_text_en ?? ""}`;
    const group = groups.get(key) ?? { props: p, areas: [], areasFr: [] };
    if (p.feature_name_en && !group.areas.includes(p.feature_name_en)) {
      group.areas.push(p.feature_name_en);
      group.areasFr.push(p.feature_name_fr ?? p.feature_name_en);
    }
    groups.set(key, group);
  }

  const areaText = (names: string[], more: (n: number) => string) =>
    names.length > 3 ? `${names.slice(0, 2).join("; ")} ${more(names.length - 2)}` : names.join("; ");
  const firstParagraph = (text: string | undefined) => (text ?? "").split(/\n\s*\n/)[0]?.trim() ?? "";

  return [...groups.values()].map(({ props: p, areas, areasFr }) => {
    const end = validIso(p.event_end_datetime);
    const resolution: AlertResolution = end
      ? { kind: "ends", at: end }
      : { kind: "ongoing", note: "In effect until Environment Canada ends it" };
    const summary = firstParagraph(p.alert_text_en);
    const summaryFr = firstParagraph(p.alert_text_fr);
    return {
      id: `eccc-${p.province}-${p.alert_code}-${p.feature_id ?? areas[0] ?? ""}`,
      jurisdiction: p.province as ProvinceCode,
      agency: "ECCC",
      agencyName: "Environment and Climate Change Canada",
      category: "weather" as const,
      severity: ecccSeverity(p),
      title: sentenceCase(p.alert_name_en ?? "Weather alert"),
      detail: clip(summary),
      area: areaText(areas, (n) => `and ${n} more areas`),
      updatedAt: validIso(p.publication_datetime),
      resolution,
      sourceUrl: ECCC_PUBLIC_URL,
      translations: {
        fr: {
          title: p.alert_name_fr ? sentenceCase(p.alert_name_fr) : undefined,
          detail: summaryFr ? clip(summaryFr) : undefined,
          area: areaText(areasFr, (n) => `et ${n} autres secteurs`),
        },
      },
      sourceText: ["detail", "area"],
    };
  });
}

/* ------------------------------------------------------------------ */
/* DriveBC (Open511)                                                   */
/* ------------------------------------------------------------------ */

interface Open511Event {
  id: string;
  headline?: string;
  description?: string;
  event_type?: string;
  event_subtypes?: string[];
  severity?: string;
  updated?: string;
  schedule?: { intervals?: string[] };
  roads?: Array<{ name?: string; from?: string }>;
  areas?: Array<{ name?: string }>;
}

export function mapDriveBcEvents(payload: unknown, now = Date.now(), limit = 25): RegionalAlert[] {
  const events = (payload as { events?: Open511Event[] })?.events ?? [];
  const soon = now + 24 * 60 * 60 * 1000;

  return events
    .filter((e) => e.severity === "MAJOR")
    .flatMap((e): RegionalAlert[] => {
      const [start, end] = (e.schedule?.intervals?.[0] ?? "").split("/");
      const startsAt = validIso(start);
      if (startsAt && Date.parse(startsAt) > soon) return [];
      const endsAt = end ? validIso(end) : undefined;
      if (endsAt && Date.parse(endsAt) < now) return [];

      const incident = e.event_type === "INCIDENT";
      const maintenance = e.event_subtypes?.includes("ROAD_MAINTENANCE") ?? false;
      const road = e.roads?.[0];
      const place = [road?.name && road.name !== "Other Roads" ? road.name : null, road?.from].filter(Boolean).join(" at ");
      const kind = incident ? "Incident" : sentenceCase((e.headline ?? "Road event").toLowerCase());

      return [
        {
          id: `drivebc-${e.id}`,
          jurisdiction: "BC",
          agency: "DriveBC",
          agencyName: "DriveBC (BC Ministry of Transportation)",
          category: maintenance ? "maintenance" : "road",
          severity: incident ? "critical" : "moderate",
          title: place ? `${kind}: ${place}` : kind,
          detail: clip((e.description ?? "").replace(/\s*Last update:.*$/i, "").trim()),
          area: e.areas?.[0]?.name,
          startsAt,
          updatedAt: validIso(e.updated),
          resolution: endsAt ? { kind: "ends", at: endsAt } : { kind: "ongoing", note: "No end time posted" },
          sourceUrl: DRIVEBC_PUBLIC_URL,
          sourceText: ["title", "detail", "area"],
        },
      ];
    })
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
    .slice(0, limit);
}

/* ------------------------------------------------------------------ */
/* Hydro-Québec                                                        */
/* ------------------------------------------------------------------ */

/** Marker tuple: [customers, start, estimated end, type ("P" = planned), coordinates, ...]. Times are Eastern. */
type HydroQuebecMarker = [number, string, string, string, ...unknown[]];

/**
 * Hydro-Québec markers carry no place names, so outages are summarised:
 * one alert for unplanned outages, one for planned maintenance in progress.
 */
export function mapHydroQuebec(payload: unknown, now = Date.now()): RegionalAlert[] {
  const markers = ((payload as { pannes?: HydroQuebecMarker[] })?.pannes ?? []).map((m) => ({
    customers: Number(m[0]) || 0,
    startsAt: zonedToIso(String(m[1] ?? ""), "America/Toronto"),
    endsAt: zonedToIso(String(m[2] ?? ""), "America/Toronto"),
    planned: m[3] === "P",
  }));

  const summarize = (group: typeof markers, planned: boolean): RegionalAlert | null => {
    const active = group.filter((m) => !m.startsAt || Date.parse(m.startsAt) <= now);
    if (active.length === 0) return null;
    const customers = active.reduce((sum, m) => sum + m.customers, 0);
    const largest = Math.max(...active.map((m) => m.customers));
    const latestEnd = active
      .map((m) => m.endsAt)
      .filter((v): v is string => Boolean(v) && Date.parse(v as string) > now)
      .sort()
      .at(-1);
    const scheduled = group.length - active.length;
    const n = active.length;

    return {
      id: planned ? "hydro-quebec-planned" : "hydro-quebec-unplanned",
      jurisdiction: "QC",
      agency: "Hydro-Québec",
      agencyName: "Hydro-Québec",
      category: planned ? "maintenance" : "power",
      severity: planned ? "moderate" : powerSeverity(customers),
      title: planned
        ? n === 1
          ? "Planned maintenance: 1 interruption in progress"
          : `Planned maintenance: ${n} interruptions in progress`
        : n === 1
          ? "1 power outage across Quebec"
          : `${n} power outages across Quebec`,
      detail: [
        customers === 1 ? "1 customer without power." : `${customers.toLocaleString("en-CA")} customers without power.`,
        n > 1 ? `Largest affects ${largest.toLocaleString("en-CA")}.` : "",
        scheduled === 1 ? "1 more planned interruption scheduled." : scheduled > 1 ? `${scheduled} more planned interruptions scheduled.` : "",
      ]
        .filter(Boolean)
        .join(" "),
      updatedAt: new Date(now).toISOString(),
      resolution: latestEnd ? { kind: "estimate", at: latestEnd } : { kind: "ongoing", note: "No restoration estimate yet" },
      sourceUrl: HYDRO_QUEBEC_PUBLIC_URL,
    };
  };

  return [
    summarize(
      markers.filter((m) => !m.planned),
      false,
    ),
    summarize(
      markers.filter((m) => m.planned),
      true,
    ),
  ].filter((a): a is RegionalAlert => a !== null);
}

/* ------------------------------------------------------------------ */
/* BC Hydro                                                            */
/* ------------------------------------------------------------------ */

interface BcHydroOutage {
  id: number;
  municipality?: string;
  regionName?: string;
  cause?: string;
  numCustomersOut?: number;
  crewStatusDescription?: string;
  crewEtr?: number | null;
  showEtr?: boolean;
  dateOff?: number;
  lastUpdated?: number;
}

export function mapBcHydro(payload: unknown, limit = 10): RegionalAlert[] {
  const outages = Array.isArray(payload) ? (payload as BcHydroOutage[]) : [];
  return outages
    .filter((o) => (o.numCustomersOut ?? 0) > 0)
    .sort((a, b) => (b.numCustomersOut ?? 0) - (a.numCustomersOut ?? 0))
    .slice(0, limit)
    .map((o) => {
      const customers = o.numCustomersOut ?? 0;
      const etr = o.showEtr && o.crewEtr ? validIso(o.crewEtr) : undefined;
      const planned = /planned/i.test(o.cause ?? "");
      return {
        id: `bchydro-${o.id}`,
        jurisdiction: "BC" as const,
        agency: "BC Hydro",
        agencyName: "BC Hydro",
        category: planned ? ("maintenance" as const) : ("power" as const),
        severity: planned ? ("moderate" as const) : powerSeverity(customers),
        title: `${planned ? "Planned power interruption" : "Power outage"}${o.municipality ? ` in ${o.municipality}` : ""}`,
        detail: [
          customers === 1 ? "1 customer affected." : `${customers.toLocaleString("en-CA")} customers affected.`,
          o.cause ? `Cause: ${o.cause}.` : "",
        ]
          .filter(Boolean)
          .join(" "),
        area: o.regionName,
        startsAt: validIso(o.dateOff),
        updatedAt: validIso(o.lastUpdated),
        resolution: etr
          ? { kind: "estimate" as const, at: etr }
          : { kind: "ongoing" as const, note: o.crewStatusDescription || "No restoration estimate yet" },
        sourceUrl: BC_HYDRO_PUBLIC_URL,
        sourceText: ["area" as const],
      };
    });
}
