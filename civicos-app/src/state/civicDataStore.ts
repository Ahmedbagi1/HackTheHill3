import { createContext, useContext } from "react";
import type { LocationPreference, UserRequest } from "../types/dashboard";
import type { HousingApplicationRecord } from "../types/housing";
import type { DoctorWaitlistRecord, VerificationStep } from "../types/doctor";
import type { AutismProgramRecord, ClaimStatus, FundingClaim } from "../types/autism";
import type { StoredRequest } from "./requestTimeline";

/** Persisted per-user dataset. */
export interface CivicData {
  requests: StoredRequest[];
  housing: HousingApplicationRecord | null;
  doctor: DoctorWaitlistRecord | null;
  autism: AutismProgramRecord | null;
  readNotifications: string[];
}

export interface CivicDataContextValue {
  userKey: string;
  signedIn: boolean;
  displayName: string | null;
  emailVerified: boolean;
  data: CivicData;
  requests: UserRequest[];
  location: LocationPreference;
  setLocation: (next: Partial<LocationPreference>) => void;
  submitServiceRequest: (input: { serviceId: string; title: string; referenceId: string; summary: UserRequest["summary"] }) => void;
  saveHousing: (record: Omit<HousingApplicationRecord, "requestId" | "submittedAt">) => string;
  toggleHousingDocument: (documentId: string) => void;
  saveDoctor: (record: Omit<DoctorWaitlistRecord, "requestId" | "submittedAt">) => string;
  updateDoctorVerification: (verification: VerificationStep[]) => void;
  saveAutism: (record: Omit<AutismProgramRecord, "requestId" | "submittedAt" | "claims">) => string;
  addClaim: (claim: Omit<FundingClaim, "id" | "status">) => void;
  setClaimStatus: (claimId: string, status: ClaimStatus) => void;
  withdrawRequest: (requestId: string) => void;
  markNotificationsRead: (ids: string[]) => void;
  seedDemo: () => void;
  clearDemo: () => void;
}

export const CivicDataContext = createContext<CivicDataContextValue | null>(null);

export function useCivicData(): CivicDataContextValue {
  const context = useContext(CivicDataContext);
  if (!context) throw new Error("useCivicData must be used inside <CivicDataProvider>");
  return context;
}
