import type { RegionalMarket } from "../../types/housing";

/**
 * Regional market parameters for Rent-Geared-to-Income (RGI) assistance.
 * Ontario service managers set local Household Income Limits (HILs); CivicOS
 * currently carries Ottawa's.
 *
 * Source: The Social Housing Registry of Ottawa, "Income and Asset Limit Rules
 * for RGI Applicants" (last updated January 2026).
 */
export const REGIONAL_MARKETS: Record<RegionalMarket["id"], RegionalMarket> = {
  ottawa: {
    id: "ottawa",
    label: "City of Ottawa",
    incomeLimits: { 0: 51500, 1: 62000, 2: 74000, 3: 80000, 4: 94500 },
    assetLimits: { single: 50000, multiple: 75000 },
    effective: "January 2026",
    registry: {
      name: "The Social Housing Registry of Ottawa",
      url: "https://housingregistry.ca/",
      phone: "613-526-2088",
    },
  },
};

/** RGI rent is capped at 30% of gross household income. */
export const RGI_RENT_SHARE = 0.3;

/** CMHC affordability standard: shelter costs of 30%+ of before-tax income. */
export const AFFORDABILITY_THRESHOLD = 0.3;
export const SEVERE_AFFORDABILITY_THRESHOLD = 0.5;

export const MIN_APPLICANT_AGE = 16;

/** Owners must sell residential property within this many days of being housed. */
export const PROPERTY_SALE_DAYS = 180;
