/**
 * Caregiver triage for the Autistic Child Help Program (Ontario Autism Program).
 *
 * Maps the child's age, diagnostic status and developmental support needs to
 * OAP pathways, therapy types and an indicative core clinical funding amount.
 * The binding support-needs level is set by an AccessOAP care coordinator
 * during the determination-of-needs interview; this estimate helps families plan.
 */

import type {
  AutismIntake,
  AutismTriageResult,
  DevelopmentalDomain,
  DomainSeverity,
  FundingClaim,
  FundingEstimate,
  OapAgeBand,
  ProgramPathway,
  SupportNeedsLevel,
  TherapyRecommendation,
  TherapyType,
  TriageUrgency,
} from "../../types/autism";
import {
  ACCESS_OAP_URL,
  EARLY_YEARS_MONTHS,
  OAP_FUNDING,
  OAP_INSTALLMENT_CAP,
  OAP_MAX_AGE,
  OAP_URL,
  THERAPY_LABELS,
} from "./oapRules";

const SEVERITY_POINTS: Record<DomainSeverity, number> = { mild: 1, moderate: 2, significant: 3 };

export function childAge(dateOfBirth: string, today = new Date()) {
  const [y, m, d] = dateOfBirth.split("-").map(Number);
  const birth = new Date(y, m - 1, d);
  let months = (today.getFullYear() - birth.getFullYear()) * 12 + (today.getMonth() - birth.getMonth());
  if (today.getDate() < birth.getDate()) months -= 1;
  const jan1 = new Date(today.getFullYear(), 0, 1);
  let ageOnJan1 = jan1.getFullYear() - birth.getFullYear();
  if (jan1 < new Date(jan1.getFullYear(), birth.getMonth(), birth.getDate())) ageOnJan1 -= 1;
  return { months: Math.max(0, months), years: Math.max(0, Math.floor(months / 12)), ageOnJan1: Math.max(0, ageOnJan1) };
}

export function ageBandFor(ageOnJan1: number): OapAgeBand | null {
  if (ageOnJan1 < 0 || ageOnJan1 >= OAP_MAX_AGE) return null;
  if (ageOnJan1 <= 3) return "up-to-3";
  if (ageOnJan1 <= 9) return "4-9";
  if (ageOnJan1 <= 14) return "10-14";
  return "15-17";
}

/** Indicative support-needs level from caregiver-reported domain severities. */
export function estimateSupportLevel(intake: AutismIntake): SupportNeedsLevel {
  const severities = Object.values(intake.domains).filter(Boolean) as DomainSeverity[];
  const points = severities.reduce((sum, s) => sum + SEVERITY_POINTS[s], 0);
  const significant = severities.filter((s) => s === "significant").length;

  if (intake.urgentSafetyConcern || significant >= 3 || points >= 12) return "extensive";
  if (points >= 9) return "moderate-plus";
  if (points >= 5) return "moderate";
  return "limited";
}

export function estimateFunding(band: OapAgeBand, level: SupportNeedsLevel): FundingEstimate {
  const table = OAP_FUNDING[band];
  // Bands without a moderate-plus level fall back to moderate.
  const effective: SupportNeedsLevel = table[level] !== undefined ? level : "moderate";
  const annualAmount = table[effective] as number;
  return {
    ageBand: band,
    level: effective,
    annualAmount,
    installments: annualAmount > OAP_INSTALLMENT_CAP ? Math.ceil(annualAmount / OAP_INSTALLMENT_CAP) : 1,
    bandTable: (Object.entries(table) as Array<[SupportNeedsLevel, number]>).map(([lvl, amount]) => ({ level: lvl, amount })),
  };
}

const THERAPY_MAP: Record<DevelopmentalDomain, TherapyType[]> = {
  communication: ["speech-language"],
  social: ["aba", "speech-language"],
  behaviour: ["aba"],
  learning: ["aba"],
  sensory: ["occupational"],
  motor: ["occupational"],
  "daily-living": ["occupational"],
};

export function recommendTherapies(intake: AutismIntake, ageYears: number): TherapyRecommendation[] {
  const byTherapy = new Map<TherapyType, DevelopmentalDomain[]>();
  for (const [domain, severity] of Object.entries(intake.domains) as Array<[DevelopmentalDomain, DomainSeverity | undefined]>) {
    if (!severity) continue;
    for (const therapy of THERAPY_MAP[domain]) byTherapy.set(therapy, [...(byTherapy.get(therapy) ?? []), domain]);
  }
  // Mental health supports for older children with significant behaviour or social needs.
  const behaviour = intake.domains.behaviour;
  const social = intake.domains.social;
  if (ageYears >= 6 && (behaviour === "significant" || social === "significant")) {
    byTherapy.set("mental-health", [behaviour === "significant" ? "behaviour" : "social"]);
  }
  return [...byTherapy.entries()].map(([therapy, because]) => ({ therapy, label: THERAPY_LABELS[therapy], because }));
}

function determineUrgency(intake: AutismIntake, ageMonths: number): TriageUrgency {
  if (intake.urgentSafetyConcern) return "urgent";
  const significant = Object.values(intake.domains).some((s) => s === "significant");
  if (significant || ageMonths <= 48) return "priority";
  return "standard";
}

export function triageAutismIntake(intake: AutismIntake, today = new Date()): AutismTriageResult {
  const { months, years, ageOnJan1 } = childAge(intake.dateOfBirth, today);
  const band = ageBandFor(ageOnJan1);

  const eligibilityGaps: string[] = [];
  if (years >= OAP_MAX_AGE) eligibilityGaps.push("The OAP serves children and youth under 18.");
  if (!intake.livesInOntario) eligibilityGaps.push("The child must live in Ontario.");
  if (!intake.hasWrittenDiagnosis) eligibilityGaps.push("A written autism diagnosis from a qualified professional is required.");
  const oapEligible = eligibilityGaps.length === 0;
  const registered = intake.registeredWithOap;

  const pathways: ProgramPathway[] = [];

  if (!intake.hasWrittenDiagnosis) {
    pathways.push({
      id: "diagnostic-assessment",
      name: "Diagnostic assessment",
      description: "A qualified professional, such as a physician or psychologist, assesses and documents a diagnosis.",
      status: "recommended",
      reason:
        intake.diagnosisStatus === "assessment-pending"
          ? "Your assessment is underway; ask for the diagnosis in writing."
          : "The OAP requires a written diagnosis before registration.",
      nextStep: "Ask your family doctor or nurse practitioner for a referral.",
    });
  }

  pathways.push({
    id: "oap-registration",
    name: "Register with the Ontario Autism Program",
    description: "Registration through AccessOAP opens every OAP service and assigns a care coordinator.",
    status: registered ? "eligible" : oapEligible ? "recommended" : "not-yet",
    reason: registered ? "Already registered." : oapEligible ? "Your child meets the registration criteria." : eligibilityGaps.join(" "),
    nextStep: registered ? "Keep your contact details current with AccessOAP." : "Register online or by phone with AccessOAP.",
    url: ACCESS_OAP_URL,
  });

  if (intake.urgentSafetyConcern) {
    pathways.push({
      id: "urgent-response",
      name: "Urgent response services",
      description: "Rapid, time-limited help when a child is at risk of harm or of losing their home or school placement.",
      status: oapEligible ? "recommended" : "not-yet",
      reason: "You reported an urgent safety concern.",
      nextStep: "Tell AccessOAP it's urgent. If anyone is in immediate danger, call 9-1-1.",
      url: OAP_URL,
    });
  }

  pathways.push({
    id: "foundational-family-services",
    name: "Foundational family services",
    description: "Caregiver workshops, coaching, peer mentoring and family clinics.",
    status: !oapEligible ? "not-yet" : registered ? "eligible" : "recommended",
    reason: oapEligible ? "Available to all registered families." : "Available after OAP registration.",
    nextStep: "Ask your care coordinator for local sessions.",
    url: OAP_URL,
  });

  const inEarlyYears = months >= EARLY_YEARS_MONTHS.min && months <= EARLY_YEARS_MONTHS.max;
  pathways.push({
    id: "caregiver-mediated-early-years",
    name: "Caregiver-mediated early years programs",
    description: "Caregivers learn strategies to support communication and play at home.",
    status: months < EARLY_YEARS_MONTHS.min ? "not-yet" : inEarlyYears ? (oapEligible ? "eligible" : "not-yet") : "not-eligible",
    reason: inEarlyYears
      ? "For children 12 to 48 months old."
      : months < EARLY_YEARS_MONTHS.min
        ? "Available from 12 months of age."
        : "For children 12 to 48 months old.",
    nextStep: "Request a spot through AccessOAP.",
    url: OAP_URL,
  });

  pathways.push({
    id: "entry-to-school",
    name: "Entry to school program",
    description: "Group-based support to prepare children starting kindergarten or grade 1.",
    status: intake.schoolStage === "entering-school" ? (oapEligible ? "eligible" : "not-yet") : "not-eligible",
    reason: intake.schoolStage === "entering-school" ? "Your child is starting school." : "For children starting school for the first time.",
    nextStep: "Ask AccessOAP about the next intake before the school year.",
    url: OAP_URL,
  });

  pathways.push({
    id: "core-clinical-services",
    name: "Core clinical services funding",
    description: "Annual funding for ABA, speech-language, occupational therapy and mental health services.",
    status: !oapEligible ? "not-yet" : registered ? "eligible" : "recommended",
    reason: "Set after a determination-of-needs interview with a care coordinator.",
    nextStep: "Watch for your funding invitation from AccessOAP.",
    url: OAP_URL,
  });

  const level = estimateSupportLevel(intake);
  const funding = band && intake.hasWrittenDiagnosis ? estimateFunding(band, level) : null;

  return {
    ageYears: years,
    ageMonths: months,
    ageOnJan1,
    oapEligible,
    eligibilityGaps,
    urgency: determineUrgency(intake, months),
    pathways,
    therapies: recommendTherapies(intake, years),
    funding,
  };
}

/* ------------------------------------------------------------------ */
/* Funding claim tracking                                              */
/* ------------------------------------------------------------------ */

export interface ClaimSummary {
  allocated: number;
  claimed: number;
  reimbursed: number;
  pending: number;
  remaining: number;
  /** Families must report expenses before the next installment is released. */
  reportingRequired: boolean;
}

export function summarizeClaims(allocated: number, claims: FundingClaim[]): ClaimSummary {
  const counted = claims.filter((c) => c.status !== "rejected");
  const claimed = counted.reduce((sum, c) => sum + c.amount, 0);
  const reimbursed = counted.filter((c) => c.status === "reimbursed").reduce((sum, c) => sum + c.amount, 0);
  const pending = claimed - reimbursed;
  return {
    allocated,
    claimed,
    reimbursed,
    pending,
    remaining: Math.max(0, allocated - claimed),
    reportingRequired: allocated > OAP_INSTALLMENT_CAP,
  };
}
