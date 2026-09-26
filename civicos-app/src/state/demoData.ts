/**
 * Demo profile for presentations: realistic requests produced by the real
 * eligibility and matching engines, each flagged `demo: true` so the UI labels
 * them and "Clear demo data" removes them.
 */

import type { CivicData } from "./civicDataStore";
import type { StoredRequest } from "./requestTimeline";
import type { HousingIntake } from "../types/housing";
import type { PatientIntake } from "../types/doctor";
import { evaluateHousingEligibility } from "../modules/housing/housingEligibility";
import { buildVerification, matchClinics } from "../modules/doctor/doctorMatching";
import { makeId, makeReference } from "./storage";

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

export function buildDemoData(prev: CivicData): CivicData {
  const withoutDemo = prev.requests.filter((r) => !r.demo);

  /* Housing: family of three, rent burden high, 2 of 4 documents ready. */
  const housingIntake: HousingIntake = {
    serviceArea: "ottawa",
    applicantAge: 34,
    hasSpouse: false,
    children: 2,
    otherAdults: 0,
    annualIncome: 48000,
    assets: 6000,
    statusInCanada: "citizen",
    arrears: "none",
    livesIndependently: true,
    ownsResidentialProperty: false,
    currentMonthlyRent: 1850,
    accessibilityNeeds: false,
    priority: { specialProvincialPriority: false, overHoused: false, urgentSafety: false, lifeThreateningMedical: false, homeless: false },
  };
  const housingResult = evaluateHousingEligibility(housingIntake);
  const housingId = makeId();
  const housingSubmitted = daysAgo(20);

  /* Doctor: verified patient waiting at their top match. */
  const patient: PatientIntake = {
    healthNumber: "1234-567-890-AB",
    dateOfBirth: "1991-04-12",
    neighbourhoodId: "centretown",
    languages: ["English", "French"],
    languageRequired: false,
    needs: ["mental-health"],
    wheelchairAccessRequired: false,
    maxDistanceKm: 10,
    providerPreference: "any",
    eveningHoursPreferred: true,
    virtualCareOk: true,
    complexity: { chronicConditions: 0, recentHospitalDischarge: false, pregnant: false },
  };
  const match = matchClinics(patient);
  const top = match.matches[0];
  const doctorId = makeId();
  const doctorSubmitted = daysAgo(9);

  const demoRequests: StoredRequest[] = [
    {
      id: housingId,
      referenceId: makeReference("RGI"),
      serviceId: "housing",
      module: "housing",
      title: "Subsidized housing application",
      category: "housing",
      submittedAt: housingSubmitted,
      demo: true,
      summary: [
        { label: "Unit size", value: `${housingResult.bedroomsEligible}-bedroom` },
        { label: "Priority", value: housingResult.priority.label },
        { label: "Estimated RGI rent", value: `$${housingResult.estimatedRgiRent.toLocaleString("en-CA")}/month` },
      ],
    },
    {
      id: doctorId,
      referenceId: makeReference("HCC"),
      serviceId: "doctor",
      module: "doctor",
      title: `Family doctor waitlist: ${top.clinic.name}`,
      category: "health",
      submittedAt: doctorSubmitted,
      demo: true,
      waitlistPosition: top.waitlistPosition,
      stageDays: { waiting: top.estimatedWaitWeeks * 7 },
      summary: [
        { label: "Clinic", value: `${top.clinic.name} (${top.clinic.neighbourhood})` },
        { label: "Estimated wait", value: `about ${top.estimatedWaitWeeks} weeks` },
        { label: "Priority", value: "Standard" },
      ],
    },
    {
      id: makeId(),
      referenceId: makeReference("CIV"),
      serviceId: "passport",
      module: "service",
      title: "Passport Services",
      category: "identity",
      submittedAt: daysAgo(5),
      demo: true,
      summary: [{ label: "Request", value: "Renewal · standard mail" }],
    },
  ];

  return {
    ...prev,
    // Demo housing/doctor records replace the user's own; keep everything else.
    requests: [...demoRequests, ...withoutDemo.filter((r) => r.module === "service" || r.module === "autism")],
    housing: {
      requestId: housingId,
      intake: housingIntake,
      result: housingResult,
      documentsReady: ["status", "identity"],
      submittedAt: housingSubmitted,
    },
    doctor: {
      requestId: doctorId,
      intake: patient,
      selectedClinicId: top.clinic.id,
      match: top,
      priority: match.priority,
      verification: buildVerification(patient, { emailVerified: true, consentGiven: true }),
      submittedAt: doctorSubmitted,
    },
  };
}
