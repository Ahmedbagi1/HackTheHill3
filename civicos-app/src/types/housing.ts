/**
 * Provincial Housing Assistance (Rent-Geared-to-Income) domain.
 * Rules follow Ontario's RGI framework as administered in Ottawa by
 * The Social Housing Registry of Ottawa.
 */

export type ServiceAreaId = "ottawa";

export interface RegionalMarket {
  id: ServiceAreaId;
  label: string;
  /** Household Income Limits by largest eligible bedroom count (4 = 4+). */
  incomeLimits: Record<0 | 1 | 2 | 3 | 4, number>;
  assetLimits: { single: number; multiple: number };
  effective: string;
  registry: { name: string; url: string; phone: string };
}

export type StatusInCanada = "citizen" | "permanent-resident" | "refugee" | "refugee-claimant" | "other";

export type ArrearsStatus = "none" | "repayment-agreement" | "outstanding";

export interface HousingPriorityFlags {
  /** Special Provincial Priority: survivor of abuse or human trafficking. */
  specialProvincialPriority: boolean;
  /** Currently in an RGI unit larger than the household's occupancy standard. */
  overHoused: boolean;
  /** Local Priority Access Status sub-categories. */
  urgentSafety: boolean;
  lifeThreateningMedical: boolean;
  homeless: boolean;
}

export interface HousingIntake {
  serviceArea: ServiceAreaId | "other";
  applicantAge: number;
  hasSpouse: boolean;
  /** Other household members besides the applicant and spouse. */
  children: number;
  otherAdults: number;
  /** Combined annual household income before tax. */
  annualIncome: number;
  /** Non-exempt assets (cash, investments, property). */
  assets: number;
  statusInCanada: StatusInCanada;
  arrears: ArrearsStatus;
  livesIndependently: boolean;
  ownsResidentialProperty: boolean;
  /** Current monthly rent, if renting. */
  currentMonthlyRent: number | null;
  accessibilityNeeds: boolean;
  priority: HousingPriorityFlags;
}

export type EligibilityCheckStatus = "pass" | "fail" | "review";

export interface EligibilityCheck {
  id: string;
  label: string;
  status: EligibilityCheckStatus;
  detail: string;
}

export type HousingPriorityCategory =
  | "special-provincial"
  | "over-housed"
  | "local-urgent-safety"
  | "local-medical"
  | "local-homeless"
  | "chronological";

export interface HousingPriority {
  category: HousingPriorityCategory;
  label: string;
  /** Selection order: 1 is housed first. */
  rank: number;
  explanation: string;
}

export type AffordabilityTier = "severe" | "core-need" | "moderate" | "unknown";

export interface AffordabilityAssessment {
  tier: AffordabilityTier;
  label: string;
  /** Share of gross monthly income spent on rent. */
  rentShare: number | null;
}

export interface DocumentRequirement {
  id: string;
  label: string;
  detail: string;
  required: boolean;
}

export interface HousingEligibilityResult {
  status: "eligible" | "ineligible" | "needs-review" | "unsupported-area";
  householdSize: number;
  bedroomsEligible: number;
  incomeLimit: number | null;
  assetLimit: number | null;
  /** Income limit minus income (negative when over). */
  incomeHeadroom: number | null;
  checks: EligibilityCheck[];
  priority: HousingPriority;
  affordability: AffordabilityAssessment;
  /** Estimated RGI rent: 30% of gross monthly income. */
  estimatedRgiRent: number;
  documents: DocumentRequirement[];
  alternatives: string[];
}

export interface HousingApplicationRecord {
  requestId: string;
  intake: HousingIntake;
  result: HousingEligibilityResult;
  /** Document ids the applicant has marked as ready. */
  documentsReady: string[];
  submittedAt: string;
}
