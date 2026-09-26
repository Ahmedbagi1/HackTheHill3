import type { ProvinceCode, ServiceCategoryId } from "./dashboard";

/** Level-of-government tab in the service navigation bar. */
export type TierFilter = "all" | "federal" | "provincial" | "municipal";

/** Quick-intent chip under the search bar. */
export type IntentId = "all" | "ids" | "taxes" | "health-family" | "transit-housing" | "waste-permits";

export interface QuickIntent {
  id: IntentId;
  label: string;
  /** Catalog service and module ids that belong to this intent. */
  members: ReadonlySet<string>;
  /** Categories matched by official provincial portals outside Ontario. */
  portalCategories: ReadonlySet<ServiceCategoryId>;
}

export interface DirectoryFilters {
  query: string;
  tier: TierFilter;
  intent: IntentId;
  /** Province shown under the Provincial / Territorial tab. `null` follows the user's location. */
  province: ProvinceCode | null;
}

/** An official provincial or territorial service outside CivicOS's Ontario catalog. */
export interface ProvincialPortal {
  id: string;
  province: ProvinceCode;
  title: string;
  agency: string;
  summary: string;
  url: string;
  category: ServiceCategoryId;
}
