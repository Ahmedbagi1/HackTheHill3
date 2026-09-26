/**
 * Autistic Child Help Program domain, modelled on the Ontario Autism Program (OAP).
 */

export type DiagnosisStatus = "diagnosed" | "assessment-pending" | "concerns";

export type DevelopmentalDomain =
  | "communication"
  | "social"
  | "sensory"
  | "motor"
  | "behaviour"
  | "daily-living"
  | "learning";

export type DomainSeverity = "mild" | "moderate" | "significant";

export type SchoolStage = "not-yet" | "entering-school" | "in-school";

export interface AutismIntake {
  childFirstName: string;
  dateOfBirth: string;
  livesInOntario: boolean;
  diagnosisStatus: DiagnosisStatus;
  /** Written diagnosis from a qualified professional is on hand. */
  hasWrittenDiagnosis: boolean;
  registeredWithOap: boolean;
  domains: Partial<Record<DevelopmentalDomain, DomainSeverity>>;
  /** Risk of harm to self or others, or of losing housing/school placement. */
  urgentSafetyConcern: boolean;
  schoolStage: SchoolStage;
  languageAtHome: string;
}

export type OapAgeBand = "up-to-3" | "4-9" | "10-14" | "15-17";

export type SupportNeedsLevel = "limited" | "moderate" | "moderate-plus" | "extensive";

export interface FundingEstimate {
  ageBand: OapAgeBand;
  level: SupportNeedsLevel;
  annualAmount: number;
  /** Single payment when under $25,000; otherwise installments of up to $25,000. */
  installments: number;
  /** Other levels in the same band, for context. */
  bandTable: Array<{ level: SupportNeedsLevel; amount: number }>;
}

export type PathwayId =
  | "diagnostic-assessment"
  | "oap-registration"
  | "foundational-family-services"
  | "caregiver-mediated-early-years"
  | "entry-to-school"
  | "urgent-response"
  | "core-clinical-services";

export interface ProgramPathway {
  id: PathwayId;
  name: string;
  description: string;
  status: "recommended" | "eligible" | "not-yet" | "not-eligible";
  reason: string;
  nextStep: string;
  url?: string;
}

export type TherapyType = "aba" | "speech-language" | "occupational" | "mental-health";

export interface TherapyRecommendation {
  therapy: TherapyType;
  label: string;
  because: DevelopmentalDomain[];
}

export type TriageUrgency = "urgent" | "priority" | "standard";

export interface AutismTriageResult {
  ageYears: number;
  ageMonths: number;
  ageOnJan1: number;
  oapEligible: boolean;
  eligibilityGaps: string[];
  urgency: TriageUrgency;
  pathways: ProgramPathway[];
  therapies: TherapyRecommendation[];
  funding: FundingEstimate | null;
}

export interface ServiceProvider {
  id: string;
  name: string;
  therapies: TherapyType[];
  neighbourhood: string;
  languages: string[];
  acceptingClients: boolean;
  /** Verified as a qualified OAP provider in the illustrative directory. */
  verified: boolean;
  sample: true;
}

export type ClaimStatus = "submitted" | "approved" | "reimbursed" | "rejected";

export interface FundingClaim {
  id: string;
  date: string;
  providerName: string;
  therapy: TherapyType;
  amount: number;
  status: ClaimStatus;
}

export interface PeerResource {
  id: string;
  name: string;
  description: string;
  url: string;
  kind: "peer-support" | "navigation" | "crisis" | "early-years";
}

export interface AutismProgramRecord {
  requestId: string;
  intake: AutismIntake;
  triage: AutismTriageResult;
  claims: FundingClaim[];
  submittedAt: string;
}
