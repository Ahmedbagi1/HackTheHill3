/**
 * Vite dev/preview middleware that aggregates live civic feeds server-side
 * (several sources don't send CORS headers) and caches them briefly.
 *
 *   GET /api/feeds/disruptions?lat=&lon=
 *       City of Ottawa traffic events, OC Transpo service updates, Hydro Ottawa
 *       outage summary. Returns the DisruptionFeed shape in src/types/dashboard.ts.
 *   GET /api/feeds/news?province=ON
 *       CBC national + provincial RSS headlines (NewsItem[]).
 *   GET /api/feeds/alerts
 *       Pan-Canadian alerts: ECCC weather, DriveBC, Hydro-Québec, BC Hydro and
 *       Hydro Ottawa (RegionalAlertFeed in src/types/alerts.ts). The client
 *       filters by region so switching jurisdictions needs no round trip.
 */

import {
  BC_HYDRO_OUTAGES_URL,
  BC_HYDRO_PUBLIC_URL,
  DRIVEBC_EVENTS_URL,
  DRIVEBC_PUBLIC_URL,
  ECCC_ALERTS_URL,
  ECCC_PUBLIC_URL,
  HYDRO_QUEBEC_MARKERS_URL,
  HYDRO_QUEBEC_PUBLIC_URL,
  HYDRO_QUEBEC_VERSION_URL,
  mapBcHydro,
  mapDriveBcEvents,
  mapEcccAlerts,
  mapHydroQuebec,
  sortAlerts,
} from "../src/lib/alertSources.ts";

const OTTAWA_TRAFFIC_URL = "https://traffic.ottawa.ca/map/service/events?accept-language=en";
const OC_TRANSPO_RSS_URL = "https://www.octranspo.com/en/feeds/updates-en/";
const HYDRO_OTTAWA_STATE_URL =
  "https://kubra.io/stormcenter/api/v1/stormcenters/75aa35eb-53c1-42e0-b705-d8abcf71334a/views/671ab4e4-6e66-453f-9179-040b44c3f155/currentState?preview=false";
const CBC_RSS = (slug) => `https://www.cbc.ca/webfeed/rss/rss-${slug}`;

const PROVINCE_FEEDS = {
  AB: ["canada-calgary", "canada-edmonton"],
  BC: ["canada-britishcolumbia"],
  MB: ["canada-manitoba"],
  NB: ["canada-newbrunswick"],
  NL: ["canada-newfoundland"],
  NS: ["canada-novascotia"],
  NT: ["canada-north"],
  NU: ["canada-north"],
  ON: ["canada-ottawa", "canada-toronto"],
  PE: ["canada-pei"],
  QC: ["canada-montreal"],
  SK: ["canada-saskatchewan"],
  YT: ["canada-north"],
};
const NATIONAL_FEEDS = ["canada", "politics"];

const DISRUPTION_TTL_MS = 2 * 60 * 1000;
const ALERTS_TTL_MS = 3 * 60 * 1000;
const ALL_JURISDICTIONS = ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"];
const NEWS_TTL_MS = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;
// Identifies CivicOS honestly; some CDNs stall user agents that embed URLs.
const USER_AGENT = "Mozilla/5.0 (compatible; CivicOS/1.0)";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const cache = new Map();

async function cached(key, ttl, loader) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.value;
  const value = await loader();
  cache.set(key, { at: Date.now(), value });
  return value;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "*/*" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`${url} -> ${response.status}`);
  return response.text();
}

const fetchJson = async (url) => JSON.parse(await fetchText(url));

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", hellip: "…" };

function decodeEntities(text) {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

const stripCdata = (text) => text.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
const stripTags = (html) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

function parseRss(xml) {
  const items = [];
  for (const [, body] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const tag = (name) => {
      const all = [...body.matchAll(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "g"))];
      return all.map(([, v]) => decodeEntities(stripCdata(v.trim())).trim());
    };
    items.push({
      title: tag("title")[0] ?? "",
      link: tag("link")[0] ?? "",
      pubDate: tag("pubDate")[0] ?? "",
      categories: tag("category"),
      description: stripTags(tag("description")[0] ?? ""),
    });
  }
  return items;
}

const toIso = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

const EARTH_RADIUS_KM = 6371;
function haversineKm(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** The traffic feed stores geodata/schedule as Python-style repr strings. */
function parseLooseJson(value) {
  if (!value || typeof value !== "string") return value ?? null;
  try {
    return JSON.parse(value.replace(/'/g, '"'));
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Sources                                                             */
/* ------------------------------------------------------------------ */

async function loadTrafficEvents() {
  const payload = await fetchJson(OTTAWA_TRAFFIC_URL);
  const now = Date.now();
  return (payload.events ?? [])
    .map((event) => {
      const geo = parseLooseJson(event.geodata);
      let location;
      const coords = typeof geo?.coordinates === "string" ? parseLooseJson(geo.coordinates) : geo?.coordinates;
      if (Array.isArray(coords) && typeof coords[0] === "number") location = { lon: coords[0], lat: coords[1] };

      const schedule = parseLooseJson(event.schedule);
      const window = Array.isArray(schedule) ? schedule[0] : null;
      const startsAt = window?.startDateTime ? toIso(window.startDateTime) : undefined;
      const endsAt = window?.endDateTime ? toIso(window.endDateTime) : undefined;

      const incident = event.eventType === "INCIDENT";
      const severity = incident
        ? event.priority === "HIGH"
          ? "critical"
          : "moderate"
        : event.priority === "HIGH"
          ? "moderate"
          : "advisory";
      const kindLabel = incident ? "Incident" : event.eventType === "SPECIAL_EVENT" ? "Event closure" : "Construction";

      return {
        id: `road-${event.id}`,
        kind: "road",
        severity,
        title: `${kindLabel}: ${event.headline || event.mainStreet}`,
        detail: event.message ?? "",
        source: event.generation_source === "MTO" ? "Ontario MTO via City of Ottawa" : "City of Ottawa Traffic",
        sourceUrl: "https://traffic.ottawa.ca/",
        updatedAt: event.updated ? toIso(event.updated.replace(" ", "T")) : undefined,
        startsAt,
        endsAt,
        location,
      };
    })
    .filter((item) => {
      // Only disruptions in effect now.
      const start = item.startsAt ? Date.parse(item.startsAt) : -Infinity;
      const end = item.endsAt ? Date.parse(item.endsAt) : Infinity;
      return start <= now && now <= end;
    });
}

async function loadTransitUpdates() {
  const items = parseRss(await fetchText(OC_TRANSPO_RSS_URL));
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return items
    .map((item, index) => {
      const type = item.categories.find((c) => !c.startsWith("affectedRoutes")) ?? "Service update";
      const routes = item.categories
        .filter((c) => c.startsWith("affectedRoutes-"))
        .map((c) => c.replace("affectedRoutes-", "").trim());
      const text = `${item.title} ${type}`.toLowerCase();
      const severity = /cancel|suspend|no service|shutdown|replacement bus|line [124]\b|o-train/.test(text)
        ? "moderate"
        : /detour|alert|delay/.test(text)
          ? "advisory"
          : null;
      return {
        // Several updates can share a generic link, so include the position.
        id: `transit-${index}-${item.link}`,
        kind: "transit",
        severity,
        title: item.title,
        detail: [routes.length ? `Routes: ${routes.join(", ")}` : null, item.description.replace(/^[A-Z][a-z]+ \d{1,2} \d{4} - /, "").slice(0, 220)]
          .filter(Boolean)
          .join(" · "),
        source: "OC Transpo",
        sourceUrl: item.link || "https://www.octranspo.com/en/alerts",
        updatedAt: toIso(item.pubDate),
      };
    })
    .filter((item) => item.severity && item.updatedAt && Date.parse(item.updatedAt) >= cutoff);
}

async function loadPowerOutages() {
  const state = await fetchJson(HYDRO_OTTAWA_STATE_URL);
  const dataPath = state?.data?.interval_generation_data;
  if (!dataPath) throw new Error("Hydro Ottawa: missing data path");
  const summary = await fetchJson(`https://kubra.io/${dataPath}/public/summary-1/data.json`);
  const totals = summary?.summaryFileData?.totals?.[0];
  if (!totals) throw new Error("Hydro Ottawa: missing totals");

  const affected = totals.total_cust_a ?? { val: 0 };
  const customersAffectedCount = Number(affected.val) || 0;
  const masked = affected.mask && customersAffectedCount < affected.mask;
  const customersAffected = masked ? `fewer than ${affected.mask}` : customersAffectedCount.toLocaleString("en-CA");
  const outages = Number(totals.total_outages) || 0;

  const power = { outages, customersAffected, customersServed: Number(totals.total_cust_s) || 0 };
  const items = [];
  if (outages > 0) {
    items.push({
      id: "power-hydro-ottawa",
      kind: "power",
      severity: customersAffectedCount >= 1000 ? "critical" : customersAffectedCount >= 100 ? "moderate" : "advisory",
      title: `${outages} active power outage${outages === 1 ? "" : "s"}`,
      detail: `${customersAffected} Hydro Ottawa customers affected.`,
      source: "Hydro Ottawa",
      sourceUrl: "https://outages.hydroottawa.com/",
      updatedAt: toIso(summary.summaryFileData.date_generated),
    });
  }
  return { items, power };
}

const SEVERITY_ORDER = { critical: 0, moderate: 1, advisory: 2 };

async function buildDisruptionFeed(origin) {
  const [traffic, transit, power] = await Promise.allSettled([
    cached("traffic", DISRUPTION_TTL_MS, loadTrafficEvents),
    cached("transit", DISRUPTION_TTL_MS, loadTransitUpdates),
    cached("power", DISRUPTION_TTL_MS, loadPowerOutages),
  ]);

  const items = [
    ...(power.status === "fulfilled" ? power.value.items : []),
    ...(transit.status === "fulfilled" ? transit.value : []),
    ...(traffic.status === "fulfilled" ? traffic.value : []),
  ].map((item) => (origin && item.location ? { ...item, distanceKm: Math.round(haversineKm(origin, item.location) * 10) / 10 } : item));

  items.sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) ||
      Date.parse(b.updatedAt ?? 0) - Date.parse(a.updatedAt ?? 0),
  );

  const status = (result) => (result.status === "fulfilled" ? "live" : "unavailable");
  for (const [name, result] of Object.entries({ traffic, transit, power })) {
    if (result.status === "rejected") console.warn(`[civic-feeds] ${name}: ${result.reason?.message ?? result.reason}`);
  }

  return {
    items,
    sources: [
      { kind: "power", label: "Hydro Ottawa outages", status: status(power), sourceUrl: "https://outages.hydroottawa.com/" },
      { kind: "road", label: "City of Ottawa road closures", status: status(traffic), sourceUrl: "https://traffic.ottawa.ca/" },
      { kind: "transit", label: "OC Transpo service updates", status: status(transit), sourceUrl: "https://www.octranspo.com/en/alerts" },
      {
        kind: "water",
        label: "Boil-water advisories",
        status: "no-feed",
        sourceUrl: "https://www.ottawapublichealth.ca/",
        note: "No public feed; Ottawa Public Health posts advisories.",
      },
    ],
    fetchedAt: new Date().toISOString(),
    power: power.status === "fulfilled" ? power.value.power : undefined,
  };
}

async function loadHydroQuebec() {
  const version = JSON.parse(await fetchText(HYDRO_QUEBEC_VERSION_URL));
  if (!/^\d+$/.test(String(version))) throw new Error("Hydro-Québec: unexpected version");
  return mapHydroQuebec(await fetchJson(HYDRO_QUEBEC_MARKERS_URL(version)));
}

/** Hydro Ottawa's summary, reshaped for the pan-Canadian panel. */
async function loadHydroOttawaAlerts() {
  const { items } = await cached("power", DISRUPTION_TTL_MS, loadPowerOutages);
  return items.map((item) => ({
    id: `ottawa-${item.id}`,
    jurisdiction: "ON",
    agency: "Hydro Ottawa",
    agencyName: "Hydro Ottawa",
    category: "power",
    severity: item.severity,
    title: item.title,
    detail: item.detail,
    area: "Ottawa",
    updatedAt: item.updatedAt,
    resolution: { kind: "ongoing", note: "Restoration times on the outage map" },
    sourceUrl: item.sourceUrl,
  }));
}

async function buildAlertFeed() {
  const sources = [
    { id: "eccc", label: "Environment Canada weather alerts", coverage: ALL_JURISDICTIONS, sourceUrl: ECCC_PUBLIC_URL, load: async () => mapEcccAlerts(await fetchJson(ECCC_ALERTS_URL)) },
    { id: "drivebc", label: "DriveBC road events", coverage: ["BC"], sourceUrl: DRIVEBC_PUBLIC_URL, load: async () => mapDriveBcEvents(await fetchJson(DRIVEBC_EVENTS_URL)) },
    { id: "bchydro", label: "BC Hydro outages", coverage: ["BC"], sourceUrl: BC_HYDRO_PUBLIC_URL, load: async () => mapBcHydro(await fetchJson(BC_HYDRO_OUTAGES_URL)) },
    { id: "hydroquebec", label: "Hydro-Québec outages", coverage: ["QC"], sourceUrl: HYDRO_QUEBEC_PUBLIC_URL, load: loadHydroQuebec },
    { id: "hydroottawa", label: "Hydro Ottawa outages", coverage: ["ON"], sourceUrl: "https://outages.hydroottawa.com/", load: loadHydroOttawaAlerts },
  ];

  const results = await Promise.allSettled(sources.map((source) => cached(`alerts:${source.id}`, ALERTS_TTL_MS, source.load)));
  results.forEach((result, i) => {
    if (result.status === "rejected") console.warn(`[civic-feeds] ${sources[i].id}: ${result.reason?.message ?? result.reason}`);
  });

  return {
    items: sortAlerts(results.flatMap((result) => (result.status === "fulfilled" ? result.value : []))),
    sources: sources.map(({ id, label, coverage, sourceUrl }, i) => ({
      id,
      label,
      coverage,
      sourceUrl,
      status: results[i].status === "fulfilled" ? "live" : "unavailable",
    })),
    fetchedAt: new Date().toISOString(),
  };
}

async function loadNewsFeed(slug, scope) {
  const items = parseRss(await fetchText(CBC_RSS(slug)));
  return items.map((item) => ({
    id: item.link,
    title: item.title,
    url: item.link.replace(/\?cmp=rss$/, ""),
    source: "CBC News",
    category: (item.categories[0] ?? "News").split("/").slice(-1)[0],
    scope,
    publishedAt: toIso(item.pubDate) ?? new Date(0).toISOString(),
  }));
}

async function buildNews(province) {
  const provincialSlugs = PROVINCE_FEEDS[province] ?? PROVINCE_FEEDS.ON;
  const load = (slug, scope) => cached(`news:${slug}`, NEWS_TTL_MS, () => loadNewsFeed(slug, scope));
  const results = await Promise.allSettled([
    ...NATIONAL_FEEDS.map((slug) => load(slug, "national")),
    ...provincialSlugs.map((slug) => load(slug, "provincial")),
  ]);

  const seen = new Set();
  const items = results
    .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
    .filter((item) => item.url && !seen.has(item.url) && seen.add(item.url))
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));

  return {
    national: items.filter((i) => i.scope === "national").slice(0, 12),
    provincial: items.filter((i) => i.scope === "provincial").slice(0, 12),
    fetchedAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Middleware                                                          */
/* ------------------------------------------------------------------ */

const sendJson = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
};

export function civicFeedsProxy() {
  const handler = async (req, res, next) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (!url.pathname.startsWith("/api/feeds/")) return next();
    if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed." });

    try {
      if (url.pathname === "/api/feeds/disruptions") {
        const lat = Number(url.searchParams.get("lat"));
        const lon = Number(url.searchParams.get("lon"));
        const origin = Number.isFinite(lat) && Number.isFinite(lon) && lat && lon ? { lat, lon } : null;
        return sendJson(res, 200, await buildDisruptionFeed(origin));
      }
      if (url.pathname === "/api/feeds/alerts") {
        return sendJson(res, 200, await buildAlertFeed());
      }
      if (url.pathname === "/api/feeds/news") {
        const province = (url.searchParams.get("province") ?? "ON").toUpperCase();
        if (!PROVINCE_FEEDS[province]) return sendJson(res, 400, { error: "Unknown province." });
        return sendJson(res, 200, await buildNews(province));
      }
      return sendJson(res, 404, { error: "Unknown feed." });
    } catch (error) {
      console.error("[civic-feeds]", error);
      return sendJson(res, 502, { error: "Feed temporarily unavailable." });
    }
  };

  return {
    name: "civicos-civic-feeds",
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}
