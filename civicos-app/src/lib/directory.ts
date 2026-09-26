import { SERVICES } from "../data/servicesData";
import { LIFE_EVENTS } from "../data/lifeEvents";
import { MODULES, SERVICE_CATEGORY, type ModuleEntry } from "../data/categories";
import { INTENTS_BY_ID, QUICK_INTENTS } from "../data/intents";
import { PROVINCIAL_PORTALS } from "../data/jurisdictions";
import { searchCatalog, tokenize } from "./search";
import type { ProvinceCode, ServiceCategoryId } from "../types/dashboard";
import type { DirectoryFilters, IntentId, ProvincialPortal, TierFilter } from "../types/directory";

export type CatalogService = (typeof SERVICES)[number];
type LifeEvent = (typeof LIFE_EVENTS)[number];
type Tier = "Federal" | "Provincial" | "Municipal";

export type DirectoryItem =
  | { kind: "service"; id: string; tier: Tier; category: ServiceCategoryId; service: CatalogService }
  | { kind: "module"; id: string; tier: "Provincial"; category: ServiceCategoryId; module: ModuleEntry }
  | { kind: "portal"; id: string; tier: "Provincial"; category: ServiceCategoryId; portal: ProvincialPortal };

/** Fields lib/search.js indexes; lets modules and portals share the catalog's ranking. */
interface Searchable {
  id: string;
  title: string;
  summary: string;
  agency: string;
  keywords: string[];
}

/** Built once so search.js can cache each entry's token index. */
const ENTRIES: Array<{ item: DirectoryItem; searchable: Searchable }> = [
  ...SERVICES.map((service) => ({
    item: {
      kind: "service" as const,
      id: service.id,
      tier: service.tier as Tier,
      category: SERVICE_CATEGORY[service.id],
      service,
    },
    searchable: service as unknown as Searchable,
  })),
  ...MODULES.map((module) => ({
    item: { kind: "module" as const, id: module.id, tier: "Provincial" as const, category: module.category, module },
    searchable: {
      id: module.id,
      title: module.title,
      summary: module.summary,
      agency: "Government of Ontario",
      keywords: module.keywords,
    },
  })),
  ...PROVINCIAL_PORTALS.map((portal) => ({
    item: { kind: "portal" as const, id: portal.id, tier: "Provincial" as const, category: portal.category, portal },
    searchable: {
      id: portal.id,
      title: portal.title,
      summary: portal.summary,
      agency: portal.agency,
      keywords: [portal.category],
    },
  })),
];

const ENTRY_BY_ID = new Map(ENTRIES.map((e) => [e.searchable.id, e]));

/** Whether an item is offered for the chosen province. Ottawa services only apply in Ontario. */
function inScope(item: DirectoryItem, province: ProvinceCode): boolean {
  if (item.kind === "portal") return item.portal.province === province;
  if (item.tier === "Federal") return true;
  return province === "ON";
}

function matchesTier(item: DirectoryItem, tier: TierFilter): boolean {
  return tier === "all" || item.tier.toLowerCase() === tier;
}

function matchesIntent(item: DirectoryItem, intentId: IntentId): boolean {
  if (intentId === "all") return true;
  const intent = INTENTS_BY_ID[intentId];
  return item.kind === "portal" ? intent.portalCategories.has(item.category) : intent.members.has(item.id);
}

export interface DirectoryResult {
  province: ProvinceCode;
  items: DirectoryItem[];
  lifeEvent: LifeEvent | null;
  stepByServiceId: Map<string, number>;
  /** Per-tab totals for the navigation bar (ignores query and intent). */
  tierCounts: Record<TierFilter, number>;
  /** Per-chip counts for the current tier and query. */
  intentCounts: Record<IntentId, number>;
  /** True when the item list is ranked by a search query rather than grouped. */
  ranked: boolean;
}

export function buildDirectory(filters: DirectoryFilters, locationProvince: ProvinceCode): DirectoryResult {
  const province = filters.province ?? locationProvince;

  // Municipal services are the City of Ottawa's, so that tab ignores the province filter.
  const scoped = ENTRIES.filter(({ item }) => item.tier === "Municipal" || inScope(item, province));
  const inAll = (item: DirectoryItem) => inScope(item, province);

  const tierCounts: Record<TierFilter, number> = {
    all: scoped.filter(({ item }) => inAll(item)).length,
    federal: scoped.filter(({ item }) => item.tier === "Federal").length,
    provincial: scoped.filter(({ item }) => item.tier === "Provincial").length,
    municipal: scoped.filter(({ item }) => item.tier === "Municipal").length,
  };

  const inTier = scoped.filter(({ item }) => matchesTier(item, filters.tier) && (filters.tier !== "all" || inAll(item)));

  const search = searchCatalog(
    filters.query,
    inTier.map((e) => e.searchable),
    LIFE_EVENTS,
  ) as { lifeEvent: LifeEvent | null; results: Searchable[]; stepByServiceId: Map<string, number> };

  const matched = search.results.flatMap((s) => {
    const entry = ENTRY_BY_ID.get(s.id);
    return entry ? [entry.item] : [];
  });

  const intentCounts = Object.fromEntries(
    QUICK_INTENTS.map((intent) => [intent.id, matched.filter((item) => matchesIntent(item, intent.id)).length]),
  ) as Record<IntentId, number>;

  return {
    province,
    items: matched.filter((item) => matchesIntent(item, filters.intent)),
    lifeEvent: search.lifeEvent,
    stepByServiceId: search.stepByServiceId,
    tierCounts,
    intentCounts,
    ranked: tokenize(filters.query).length > 0,
  };
}

export const DEFAULT_FILTERS: DirectoryFilters = { query: "", tier: "all", intent: "all", province: null };
