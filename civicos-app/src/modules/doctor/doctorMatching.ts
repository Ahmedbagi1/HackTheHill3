/**
 * Family doctor matching engine.
 *
 * 1. Hard filters: clinic status, distance, required language, wheelchair
 *    access and provider type.
 * 2. Weighted score (0–100): proximity 30, language 20, care-needs coverage 25,
 *    availability 15, convenience 10.
 * 3. Patients with greater health needs are prioritised, mirroring Health Care
 *    Connect's practice of giving priority to people with complex needs.
 */

import type {
  CareNeed,
  Clinic,
  ClinicMatch,
  DoctorMatchResult,
  ExcludedClinic,
  GeoPoint,
  PatientIntake,
  PatientPriority,
  VerificationStep,
} from "../../types/doctor";
import { CARE_NEEDS, CLINICS, NEIGHBOURHOODS } from "./clinicDirectory";

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

const needLabel = (need: CareNeed) =>
  CARE_NEEDS.find((n) => n.id === need)?.label.replace(/ \(.*\)$/, "") ?? need;

export function patientPriority(intake: PatientIntake): { priority: PatientPriority; reasons: string[] } {
  const reasons: string[] = [];
  if (intake.complexity.chronicConditions >= 2) reasons.push("Two or more chronic conditions");
  if (intake.complexity.recentHospitalDischarge) reasons.push("Recently discharged from hospital");
  if (intake.complexity.pregnant) reasons.push("Pregnancy");
  return { priority: reasons.length ? "high" : "standard", reasons };
}

const providerMatches = (clinic: Clinic, preference: PatientIntake["providerPreference"]) =>
  preference === "any" || clinic.providerType === "team" || clinic.providerType === preference;

function exclusionReason(clinic: Clinic, intake: PatientIntake, distanceKm: number): string | null {
  if (clinic.acceptingStatus === "closed") return "Not accepting or waitlisting new patients";
  if (distanceKm > intake.maxDistanceKm) return `${distanceKm.toFixed(1)} km away (limit ${intake.maxDistanceKm} km)`;
  if (intake.languageRequired && !clinic.languages.some((l) => intake.languages.includes(l))) {
    return `No provider speaks ${intake.languages.join(", ")}`;
  }
  if (intake.wheelchairAccessRequired && !clinic.wheelchairAccessible) return "Not wheelchair accessible";
  if (!providerMatches(clinic, intake.providerPreference)) {
    return intake.providerPreference === "nurse-practitioner" ? "Physician-only practice" : "Nurse practitioner-only clinic";
  }
  return null;
}

function scoreClinic(
  clinic: Clinic,
  intake: PatientIntake,
  distanceKm: number,
  priority: PatientPriority,
): ClinicMatch {
  const reasons: string[] = [];
  const gaps: string[] = [];

  // Proximity (30)
  const proximity = 30 * Math.max(0, 1 - distanceKm / Math.max(intake.maxDistanceKm, 1));
  reasons.push(`${distanceKm.toFixed(1)} km away in ${clinic.neighbourhood}`);

  // Language (20): full marks for the first-listed language, partial for others.
  const spoken = intake.languages.filter((l) => clinic.languages.includes(l));
  let language = 0;
  if (spoken.length) {
    language = spoken.includes(intake.languages[0]) ? 20 : 14;
    reasons.push(`Care available in ${spoken.join(", ")}`);
  } else {
    gaps.push(`No provider speaks ${intake.languages.join(", ")}`);
  }

  // Care-needs coverage (25)
  let coverage = 25;
  if (intake.needs.length) {
    const covered = intake.needs.filter((n) => clinic.services.includes(n));
    const missing = intake.needs.filter((n) => !clinic.services.includes(n));
    coverage = 25 * (covered.length / intake.needs.length);
    if (covered.length) reasons.push(`Offers ${covered.map(needLabel).join(", ").toLowerCase()}`);
    if (missing.length) gaps.push(`Doesn't list ${missing.map(needLabel).join(", ").toLowerCase()}`);
  }

  // Availability (15)
  const availability =
    clinic.acceptingStatus === "accepting" ? 15 : 15 * Math.max(0, 1 - clinic.typicalWaitWeeks / 52);
  if (clinic.acceptingStatus === "accepting") reasons.push("Accepting new patients");

  // Convenience (10)
  let convenience = 0;
  if (intake.eveningHoursPreferred) {
    if (clinic.eveningHours) {
      convenience += 5;
      reasons.push("Evening appointments");
    } else gaps.push("No evening hours");
  } else convenience += 5;
  if (intake.virtualCareOk && clinic.virtualCare) {
    convenience += 5;
    reasons.push("Virtual visits available");
  } else if (!intake.virtualCareOk) convenience += 5;

  // Queue estimate: higher-need patients are offered spots ahead of roughly half the queue.
  const queueShare = priority === "high" ? 0.5 : 1;
  const waitlistPosition = Math.max(1, Math.ceil(clinic.waitlistLength * queueShare) + 1);
  const estimatedWaitWeeks = Math.max(1, Math.round(clinic.typicalWaitWeeks * queueShare));

  return {
    clinic,
    score: Math.round(proximity + language + coverage + availability + convenience),
    distanceKm,
    reasons,
    gaps,
    estimatedWaitWeeks,
    waitlistPosition,
  };
}

export function matchClinics(intake: PatientIntake, clinics: Clinic[] = CLINICS, limit = 5): DoctorMatchResult {
  const home = NEIGHBOURHOODS.find((n) => n.id === intake.neighbourhoodId);
  if (!home) throw new Error(`Unknown neighbourhood: ${intake.neighbourhoodId}`);

  const { priority, reasons: priorityReasons } = patientPriority(intake);
  const matches: ClinicMatch[] = [];
  const excluded: ExcludedClinic[] = [];

  for (const clinic of clinics) {
    const distanceKm = haversineKm(home.location, clinic.location);
    const reason = exclusionReason(clinic, intake, distanceKm);
    if (reason) excluded.push({ clinic, reason });
    else matches.push(scoreClinic(clinic, intake, distanceKm, priority));
  }

  matches.sort((a, b) => b.score - a.score || a.distanceKm - b.distanceKm);
  return { priority, priorityReasons, matches: matches.slice(0, limit), excluded };
}

/** Ontario health numbers: 10 digits, optionally followed by a 1–2 letter version code. */
export const HEALTH_NUMBER_PATTERN = /^\d{4}[\s-]?\d{3}[\s-]?\d{3}([\s-]?[A-Z]{1,2})?$/i;

export function buildVerification(
  intake: PatientIntake,
  opts: { emailVerified: boolean; consentGiven: boolean },
): VerificationStep[] {
  const healthOk = HEALTH_NUMBER_PATTERN.test(intake.healthNumber.trim());
  return [
    {
      id: "health-number",
      label: "OHIP health number",
      status: healthOk ? "complete" : "failed",
      detail: healthOk ? "Format verified. Bring your card to your first visit." : "Enter a valid 10-digit health number.",
    },
    {
      id: "email",
      label: "Verified email",
      status: opts.emailVerified ? "complete" : "pending",
      detail: opts.emailVerified
        ? "Confirmed through your CivicOS account."
        : "Sign in with a verified CivicOS account so clinics can reach you.",
    },
    {
      id: "consent",
      label: "Consent to share",
      status: opts.consentGiven ? "complete" : "pending",
      detail: "Permission to share your intake with the clinic you choose.",
    },
    {
      id: "identity",
      label: "In-person identity check",
      status: "pending",
      detail: "The clinic confirms your identity and health card at your first appointment.",
    },
  ];
}
