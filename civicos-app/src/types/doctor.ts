/**
 * Family Doctor Connection domain: patient intake, clinic directory and matching.
 */

export type SpokenLanguage =
  | "English"
  | "French"
  | "Arabic"
  | "Mandarin"
  | "Cantonese"
  | "Somali"
  | "Spanish"
  | "Punjabi"
  | "Tagalog"
  | "Persian"
  | "Portuguese"
  | "Ukrainian";

export type CareNeed =
  | "chronic-conditions"
  | "mental-health"
  | "prenatal"
  | "pediatrics"
  | "seniors"
  | "lgbtq2s"
  | "newcomer"
  | "substance-use"
  | "disability";

export type ProviderType = "family-physician" | "nurse-practitioner" | "team";

export type AcceptingStatus = "accepting" | "waitlist" | "closed";

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface Clinic {
  id: string;
  name: string;
  neighbourhood: string;
  location: GeoPoint;
  providerType: ProviderType;
  providers: number;
  acceptingStatus: AcceptingStatus;
  /** People already queued for this clinic. */
  waitlistLength: number;
  /** Typical weeks from joining the list to a first appointment. */
  typicalWaitWeeks: number;
  languages: SpokenLanguage[];
  services: CareNeed[];
  wheelchairAccessible: boolean;
  eveningHours: boolean;
  virtualCare: boolean;
  /** Directory entries are illustrative, not real clinics. */
  sample: true;
}

export interface Neighbourhood {
  id: string;
  label: string;
  location: GeoPoint;
}

export interface PatientIntake {
  healthNumber: string;
  dateOfBirth: string;
  neighbourhoodId: string;
  languages: SpokenLanguage[];
  /** Only match clinics that speak one of `languages`. */
  languageRequired: boolean;
  needs: CareNeed[];
  wheelchairAccessRequired: boolean;
  maxDistanceKm: number;
  providerPreference: "any" | "family-physician" | "nurse-practitioner";
  eveningHoursPreferred: boolean;
  virtualCareOk: boolean;
  /** Indicators of greater health need used for prioritisation. */
  complexity: {
    chronicConditions: number;
    recentHospitalDischarge: boolean;
    pregnant: boolean;
  };
}

export type PatientPriority = "high" | "standard";

export interface ClinicMatch {
  clinic: Clinic;
  score: number;
  distanceKm: number;
  reasons: string[];
  gaps: string[];
  estimatedWaitWeeks: number;
  /** Estimated place in the clinic's queue if the patient joins today. */
  waitlistPosition: number;
}

export interface ExcludedClinic {
  clinic: Clinic;
  reason: string;
}

export interface VerificationStep {
  id: "health-number" | "email" | "consent" | "identity";
  label: string;
  status: "complete" | "pending" | "failed";
  detail: string;
}

export interface DoctorMatchResult {
  priority: PatientPriority;
  priorityReasons: string[];
  matches: ClinicMatch[];
  excluded: ExcludedClinic[];
}

export interface DoctorWaitlistRecord {
  requestId: string;
  intake: PatientIntake;
  selectedClinicId: string;
  match: ClinicMatch;
  priority: PatientPriority;
  verification: VerificationStep[];
  submittedAt: string;
}
