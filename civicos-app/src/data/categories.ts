import type { RequestModuleId, ServiceCategory, ServiceCategoryId } from "../types/dashboard";

export const CATEGORIES: ServiceCategory[] = [
  { id: "housing", label: "Housing", description: "Subsidized housing, tenancy and home projects" },
  { id: "health", label: "Health", description: "Doctors, health cards and coverage" },
  { id: "family", label: "Family & Social Services", description: "Children, disability and income support" },
  { id: "utilities", label: "Utilities & City Services", description: "Waste, water, taxes and 3-1-1" },
  { id: "transportation", label: "Transportation", description: "Driving, vehicles, parking and transit" },
  { id: "money", label: "Money & Benefits", description: "Taxes, credits, pensions and student aid" },
  { id: "identity", label: "Identity & Citizenship", description: "Passports, SIN, records and voting" },
  { id: "work", label: "Work & Business", description: "Employment insurance and business registration" },
  { id: "community", label: "Community & Safety", description: "Police reports, pets and recreation" },
];

/** Primary category for every catalog service in servicesData.js. */
export const SERVICE_CATEGORY: Record<string, ServiceCategoryId> = {
  passport: "identity",
  sin: "identity",
  "employment-insurance": "work",
  "cpp-oas": "money",
  "income-tax": "money",
  "canada-child-benefit": "family",
  "gst-hst-credit": "money",
  "immigration-pr": "identity",
  "voter-registration": "identity",
  "veterans-benefits": "family",
  "dental-care": "health",
  "drivers-licence": "transportation",
  "vehicle-registration": "transportation",
  ohip: "health",
  "vital-statistics": "identity",
  odsp: "family",
  "ontario-works": "family",
  osap: "money",
  "landlord-tenant-board": "housing",
  "business-registration": "work",
  "waste-collection": "utilities",
  "property-tax-water": "utilities",
  parking: "transportation",
  "building-permits": "housing",
  "pet-licensing": "community",
  "transit-discounts": "transportation",
  recreation: "community",
  "police-report": "community",
  "service-requests-311": "utilities",
};

export interface ModuleEntry {
  id: Exclude<RequestModuleId, "service">;
  title: string;
  summary: string;
  category: ServiceCategoryId;
  tier: "Provincial";
  keywords: string[];
}

/** Full-stack service modules with their own intake, logic and tracking views. */
export const MODULES: ModuleEntry[] = [
  {
    id: "housing",
    title: "Subsidized Housing (Rent-Geared-to-Income)",
    summary: "Check RGI eligibility against Ottawa's 2026 income limits, see your priority and track your waitlist documents.",
    category: "housing",
    tier: "Provincial",
    keywords: ["housing", "rent", "subsidized", "rgi", "social housing", "waitlist", "affordable"],
  },
  {
    id: "doctor",
    title: "Find a Family Doctor",
    summary: "Match with clinics by distance, language and care needs, then join a waitlist with verification.",
    category: "health",
    tier: "Provincial",
    keywords: ["doctor", "family doctor", "physician", "nurse practitioner", "clinic", "health care connect"],
  },
  {
    id: "autism",
    title: "Autism Support for Children",
    summary: "Caregiver triage for the Ontario Autism Program: pathways, therapies, funding and claims.",
    category: "family",
    tier: "Provincial",
    keywords: ["autism", "oap", "child", "therapy", "aba", "speech", "occupational therapy", "caregiver"],
  },
];
