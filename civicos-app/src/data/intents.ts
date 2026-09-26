import type { ServiceCategoryId } from "../types/dashboard";
import type { IntentId, QuickIntent } from "../types/directory";

const intent = (id: IntentId, label: string, members: string[], portalCategories: ServiceCategoryId[]): QuickIntent => ({
  id,
  label,
  members: new Set(members),
  portalCategories: new Set(portalCategories),
});

/**
 * Quick-intent chips under the search bar. A service can sit under more than
 * one intent (a driver's licence is both an ID and a transportation task).
 */
export const QUICK_INTENTS: QuickIntent[] = [
  intent("all", "All services", [], []),
  intent(
    "ids",
    "IDs & Licences",
    [
      "passport",
      "sin",
      "immigration-pr",
      "voter-registration",
      "drivers-licence",
      "vehicle-registration",
      "ohip",
      "vital-statistics",
      "business-registration",
    ],
    ["identity", "transportation"],
  ),
  intent(
    "taxes",
    "Taxes & Benefits",
    [
      "income-tax",
      "gst-hst-credit",
      "canada-child-benefit",
      "cpp-oas",
      "employment-insurance",
      "veterans-benefits",
      "odsp",
      "ontario-works",
      "osap",
      "property-tax-water",
    ],
    ["money"],
  ),
  intent(
    "health-family",
    "Health & Family",
    ["dental-care", "ohip", "canada-child-benefit", "odsp", "recreation", "doctor", "autism"],
    ["health", "family"],
  ),
  intent(
    "transit-housing",
    "Transit & Housing",
    [
      "drivers-licence",
      "vehicle-registration",
      "transit-discounts",
      "parking",
      "landlord-tenant-board",
      "building-permits",
      "housing",
    ],
    ["transportation", "housing"],
  ),
  intent(
    "waste-permits",
    "Waste & Permits",
    ["waste-collection", "building-permits", "parking", "pet-licensing", "service-requests-311", "property-tax-water"],
    ["utilities"],
  ),
];

export const INTENTS_BY_ID = Object.fromEntries(QUICK_INTENTS.map((i) => [i.id, i])) as Record<IntentId, QuickIntent>;
