/**
 * Rent-Geared-to-Income eligibility, priority and affordability evaluation.
 *
 * Mirrors the published Ottawa rules: household income against the limit for
 * the largest unit the household qualifies for, asset limits, status in Canada,
 * arrears, independent living, and the waiting-list selection order
 * (Special Provincial Priority → over-housed → Local Priority Access Status →
 * chronological).
 */

import type {
  AffordabilityAssessment,
  DocumentRequirement,
  EligibilityCheck,
  HousingEligibilityResult,
  HousingIntake,
  HousingPriority,
} from "../../types/housing";
import {
  AFFORDABILITY_THRESHOLD,
  MIN_APPLICANT_AGE,
  PROPERTY_SALE_DAYS,
  REGIONAL_MARKETS,
  RGI_RENT_SHARE,
  SEVERE_AFFORDABILITY_THRESHOLD,
} from "./housingRules";

const cad = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });

export const householdSize = (intake: HousingIntake): number =>
  1 + (intake.hasSpouse ? 1 : 0) + intake.children + intake.otherAdults;

/**
 * Largest unit the household is eligible for: one bedroom for the applicant
 * (shared with a spouse) plus one per additional member, capped at 4+.
 * Matches the Registry's example: a couple with a baby → 2 bedrooms.
 */
export const largestEligibleBedrooms = (intake: HousingIntake): 1 | 2 | 3 | 4 =>
  Math.min(4, 1 + intake.children + intake.otherAdults) as 1 | 2 | 3 | 4;

export function determinePriority(intake: HousingIntake): HousingPriority {
  const p = intake.priority;
  if (p.specialProvincialPriority) {
    return {
      category: "special-provincial",
      label: "Special Provincial Priority",
      rank: 1,
      explanation: "Survivors of abuse or human trafficking are offered housing first.",
    };
  }
  if (p.overHoused) {
    return {
      category: "over-housed",
      label: "Provincial over-housed priority",
      rank: 2,
      explanation: "Current RGI tenants in a unit larger than they need move to a right-sized unit next.",
    };
  }
  if (p.urgentSafety) {
    return {
      category: "local-urgent-safety",
      label: "Local priority: urgent safety",
      rank: 3,
      explanation: "Current abuse or extraordinary ongoing threats to safety.",
    };
  }
  if (p.lifeThreateningMedical) {
    return {
      category: "local-medical",
      label: "Local priority: life-threatening medical",
      rank: 3,
      explanation: "A terminal illness or life-threatening condition made worse by current housing.",
    };
  }
  if (p.homeless) {
    return {
      category: "local-homeless",
      label: "Local priority: homeless",
      rank: 3,
      explanation: "Living in an emergency shelter or sleeping rough.",
    };
  }
  return {
    category: "chronological",
    label: "Chronological",
    rank: 4,
    explanation: "Offers are made in order of application date.",
  };
}

export function assessAffordability(intake: HousingIntake): AffordabilityAssessment {
  const rent = intake.currentMonthlyRent;
  if (rent === null || rent <= 0) {
    return { tier: "unknown", label: "Not renting or rent not provided", rentShare: null };
  }
  const monthlyIncome = intake.annualIncome / 12;
  const rentShare = monthlyIncome > 0 ? rent / monthlyIncome : Number.POSITIVE_INFINITY;

  if (rentShare >= SEVERE_AFFORDABILITY_THRESHOLD) {
    return { tier: "severe", label: "Severe affordability pressure (50%+ of income on rent)", rentShare };
  }
  if (rentShare >= AFFORDABILITY_THRESHOLD) {
    return { tier: "core-need", label: "Unaffordable housing (30%+ of income on rent)", rentShare };
  }
  return { tier: "moderate", label: "Rent is under 30% of income", rentShare };
}

export function requiredDocuments(intake: HousingIntake): DocumentRequirement[] {
  const docs: DocumentRequirement[] = [
    {
      id: "status",
      label: "Proof of status in Canada",
      detail: "For every household member: birth certificate, citizenship card, PR card or refugee documents.",
      required: true,
    },
    {
      id: "income",
      label: "Proof of income",
      detail: "Latest Notice of Assessment or Proof of Income Statement for each member with income.",
      required: true,
    },
    {
      id: "assets",
      label: "Proof of assets",
      detail: "Bank, investment and property statements. Needed for every member when you accept an offer.",
      required: true,
    },
    {
      id: "identity",
      label: "Photo identification",
      detail: "Government-issued photo ID for adults in the household.",
      required: true,
    },
  ];

  if (intake.priority.specialProvincialPriority) {
    docs.push({
      id: "spp-verification",
      label: "Special Priority verification",
      detail: "Confirmation of abuse or trafficking from a professional such as a shelter worker, police or health provider.",
      required: true,
    });
  }
  if (intake.priority.lifeThreateningMedical) {
    docs.push({
      id: "medical",
      label: "Medical documentation",
      detail: "A health professional's letter describing the condition and how housing affects it.",
      required: true,
    });
  }
  if (intake.priority.homeless) {
    docs.push({
      id: "homeless-confirmation",
      label: "Shelter or outreach confirmation",
      detail: "A letter from an emergency shelter or outreach worker.",
      required: true,
    });
  }
  if (intake.ownsResidentialProperty) {
    docs.push({
      id: "property",
      label: "Property ownership details",
      detail: `Property must be sold within ${PROPERTY_SALE_DAYS} days of being housed.`,
      required: false,
    });
  }
  return docs;
}

export function evaluateHousingEligibility(intake: HousingIntake): HousingEligibilityResult {
  const size = householdSize(intake);
  const bedrooms = largestEligibleBedrooms(intake);
  const priority = determinePriority(intake);
  const affordability = assessAffordability(intake);
  const estimatedRgiRent = Math.round((intake.annualIncome / 12) * RGI_RENT_SHARE);
  const documents = requiredDocuments(intake);

  if (intake.serviceArea !== "ottawa") {
    return {
      status: "unsupported-area",
      householdSize: size,
      bedroomsEligible: bedrooms,
      incomeLimit: null,
      assetLimit: null,
      incomeHeadroom: null,
      checks: [
        {
          id: "area",
          label: "Service area",
          status: "review",
          detail: "CivicOS has Ottawa's income limits. Contact your local service manager for other areas.",
        },
      ],
      priority,
      affordability,
      estimatedRgiRent,
      documents,
      alternatives: ["Find your local housing service manager through 2-1-1 Ontario."],
    };
  }

  const market = REGIONAL_MARKETS.ottawa;
  const incomeLimit = market.incomeLimits[bedrooms];
  const assetLimit = size === 1 ? market.assetLimits.single : market.assetLimits.multiple;
  const incomeHeadroom = incomeLimit - intake.annualIncome;

  const checks: EligibilityCheck[] = [
    {
      id: "age",
      label: "Age",
      status: intake.applicantAge >= MIN_APPLICANT_AGE ? "pass" : "fail",
      detail: `At least one household member must be ${MIN_APPLICANT_AGE} or older.`,
    },
    {
      id: "status",
      label: "Status in Canada",
      status: intake.statusInCanada === "other" ? "fail" : "pass",
      detail: "Canadian citizens, permanent residents, refugees and refugee claimants can apply.",
    },
    {
      id: "income",
      label: `Household income (${bedrooms === 4 ? "4+" : bedrooms}-bedroom limit)`,
      status: intake.annualIncome < incomeLimit ? "pass" : "fail",
      detail:
        intake.annualIncome < incomeLimit
          ? `${cad.format(intake.annualIncome)} is under the ${cad.format(incomeLimit)} limit.`
          : `${cad.format(intake.annualIncome)} is at or over the ${cad.format(incomeLimit)} limit.`,
    },
    {
      id: "assets",
      label: "Assets",
      status: intake.assets <= assetLimit ? "pass" : "fail",
      detail: `Limit is ${cad.format(assetLimit)} for ${size === 1 ? "a single person" : "households of two or more"}. RRSPs, RESPs, RDSPs and a vehicle don't count.`,
    },
    {
      id: "arrears",
      label: "Social housing arrears",
      status: intake.arrears === "outstanding" ? "fail" : "pass",
      detail:
        intake.arrears === "repayment-agreement"
          ? "You have a repayment agreement, which keeps you eligible."
          : intake.arrears === "outstanding"
            ? "Arrears owed to an Ontario social housing provider must be repaid or under an agreement."
            : "No arrears owed to Ontario social housing providers.",
    },
    {
      id: "independent",
      label: "Independent living",
      status: intake.livesIndependently ? "pass" : "review",
      detail: "You must be able to live independently, arranging any support services you need.",
    },
  ];

  if (intake.ownsResidentialProperty) {
    checks.push({
      id: "property",
      label: "Residential property",
      status: "review",
      detail: `Owners can apply but must sell within ${PROPERTY_SALE_DAYS} days of being housed.`,
    });
  }

  const status = checks.some((c) => c.status === "fail")
    ? "ineligible"
    : checks.some((c) => c.status === "review")
      ? "needs-review"
      : "eligible";

  const alternatives: string[] = [];
  if (status === "ineligible" && incomeHeadroom <= 0) {
    alternatives.push("Affordable (below-market) rental programs have higher income limits than RGI.");
  }
  if (status !== "ineligible") {
    alternatives.push(
      "Canada-Ontario Housing Benefit (COHB): a portable monthly benefit that may be offered to people on the waiting list.",
    );
  }
  if (affordability.tier === "severe" || intake.priority.homeless) {
    alternatives.push("For help with rent arrears or emergency shelter today, call 2-1-1.");
  }

  return {
    status,
    householdSize: size,
    bedroomsEligible: bedrooms,
    incomeLimit,
    assetLimit,
    incomeHeadroom,
    checks,
    priority,
    affordability,
    estimatedRgiRent,
    documents,
    alternatives,
  };
}
