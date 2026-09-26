import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { auth0Configured } from "../lib/auth0";
import { SERVICE_CATEGORY } from "../data/categories";
import { DEFAULT_PROVINCE } from "../data/provinces";
import type { LocationPreference, RequestAction } from "../types/dashboard";
import type { VerificationStep } from "../types/doctor";
import type { ClaimStatus } from "../types/autism";
import { materializeRequest, type StoredRequest } from "./requestTimeline";
import { makeId, makeReference, readJson, writeJson } from "./storage";
import { buildDemoData } from "./demoData";
import { CivicDataContext, type CivicData, type CivicDataContextValue } from "./civicDataStore";

/* ------------------------------------------------------------------ */
/* Persisted shape                                                     */
/* ------------------------------------------------------------------ */


const EMPTY_DATA: CivicData = { requests: [], housing: null, doctor: null, autism: null, readNotifications: [] };
const dataKey = (userKey: string) => `civicos:data:${userKey}`;
const LOCATION_KEY = "civicos:location";

/* ------------------------------------------------------------------ */
/* Action derivation                                                   */
/* ------------------------------------------------------------------ */

function actionFor(stored: StoredRequest, data: CivicData): { action?: RequestAction; holdAt: string | null } {
  if (stored.module === "housing" && data.housing?.requestId === stored.id) {
    const required = data.housing.result.documents.filter((d) => d.required);
    const ready = required.filter((d) => data.housing!.documentsReady.includes(d.id)).length;
    if (ready < required.length) {
      return {
        action: {
          kind: "documents",
          label: "Gather documents",
          detail: `${ready} of ${required.length} required documents ready`,
        },
        holdAt: "review",
      };
    }
  }
  if (stored.module === "doctor" && data.doctor?.requestId === stored.id) {
    const outstanding = data.doctor.verification.filter((v) => v.id !== "identity" && v.status !== "complete");
    if (outstanding.length) {
      return {
        action: {
          kind: "verification",
          label: "Complete verification",
          detail: outstanding.map((v) => v.label).join(", "),
        },
        holdAt: "verification",
      };
    }
  }
  if (stored.module === "autism" && data.autism?.requestId === stored.id && !data.autism.intake.hasWrittenDiagnosis) {
    return {
      action: {
        kind: "documents",
        label: "Get a written diagnosis",
        detail: "The Ontario Autism Program requires a written diagnosis before registration.",
      },
      holdAt: "coordination",
    };
  }
  return { holdAt: null };
}

/* ------------------------------------------------------------------ */
/* Context                                                             */
/* ------------------------------------------------------------------ */

export function CivicDataProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth0();
  const signedIn = auth0Configured && isAuthenticated && user?.email_verified === true;
  const userKey = signedIn && user?.sub ? user.sub : "guest";

  const [state, setState] = useState(() => ({ key: userKey, data: readJson<CivicData>(dataKey(userKey), EMPTY_DATA) }));
  // Switch datasets when the signed-in user changes (derived-state pattern).
  if (state.key !== userKey) {
    setState({ key: userKey, data: readJson<CivicData>(dataKey(userKey), EMPTY_DATA) });
  }
  const data = state.key === userKey ? state.data : readJson<CivicData>(dataKey(userKey), EMPTY_DATA);

  const [location, setLocationState] = useState<LocationPreference>(() =>
    readJson<LocationPreference>(LOCATION_KEY, { province: DEFAULT_PROVINCE, source: "default" }),
  );

  const update = useCallback((updater: (prev: CivicData) => CivicData) => {
    setState((prev) => {
      const next = updater(prev.data);
      writeJson(dataKey(prev.key), next);
      return { ...prev, data: next };
    });
  }, []);

  const setLocation = useCallback((next: Partial<LocationPreference>) => {
    setLocationState((prev) => {
      const merged = { ...prev, ...next };
      writeJson(LOCATION_KEY, merged);
      return merged;
    });
  }, []);

  const addStored = (prev: CivicData, stored: StoredRequest, replaceModule: boolean): StoredRequest[] =>
    replaceModule ? [stored, ...prev.requests.filter((r) => r.module !== stored.module)] : [stored, ...prev.requests];

  const submitServiceRequest: CivicDataContextValue["submitServiceRequest"] = useCallback(
    ({ serviceId, title, referenceId, summary }) =>
      update((prev) => ({
        ...prev,
        requests: addStored(
          prev,
          {
            id: makeId(),
            referenceId,
            serviceId,
            module: "service",
            title,
            category: SERVICE_CATEGORY[serviceId] ?? "community",
            submittedAt: new Date().toISOString(),
            summary,
          },
          false,
        ),
      })),
    [update],
  );

  const saveHousing: CivicDataContextValue["saveHousing"] = useCallback(
    (record) => {
      const id = makeId();
      const submittedAt = new Date().toISOString();
      update((prev) => ({
        ...prev,
        housing: { ...record, requestId: id, submittedAt },
        requests: addStored(
          prev,
          {
            id,
            referenceId: makeReference("RGI"),
            serviceId: "housing",
            module: "housing",
            title: "Subsidized housing application",
            category: "housing",
            submittedAt,
            summary: [
              { label: "Unit size", value: `${record.result.bedroomsEligible === 4 ? "4+" : record.result.bedroomsEligible}-bedroom` },
              { label: "Priority", value: record.result.priority.label },
              { label: "Estimated RGI rent", value: `$${record.result.estimatedRgiRent.toLocaleString("en-CA")}/month` },
            ],
          },
          true,
        ),
      }));
      return id;
    },
    [update],
  );

  const toggleHousingDocument = useCallback(
    (documentId: string) =>
      update((prev) => {
        if (!prev.housing) return prev;
        const ready = prev.housing.documentsReady.includes(documentId)
          ? prev.housing.documentsReady.filter((d) => d !== documentId)
          : [...prev.housing.documentsReady, documentId];
        return { ...prev, housing: { ...prev.housing, documentsReady: ready } };
      }),
    [update],
  );

  const saveDoctor: CivicDataContextValue["saveDoctor"] = useCallback(
    (record) => {
      const id = makeId();
      const submittedAt = new Date().toISOString();
      update((prev) => ({
        ...prev,
        doctor: { ...record, requestId: id, submittedAt },
        requests: addStored(
          prev,
          {
            id,
            referenceId: makeReference("HCC"),
            serviceId: "doctor",
            module: "doctor",
            title: `Family doctor waitlist: ${record.match.clinic.name}`,
            category: "health",
            submittedAt,
            waitlistPosition: record.match.waitlistPosition,
            stageDays: { waiting: record.match.estimatedWaitWeeks * 7 },
            summary: [
              { label: "Clinic", value: `${record.match.clinic.name} (${record.match.clinic.neighbourhood})` },
              { label: "Estimated wait", value: `about ${record.match.estimatedWaitWeeks} week${record.match.estimatedWaitWeeks === 1 ? "" : "s"}` },
              { label: "Priority", value: record.priority === "high" ? "Higher need" : "Standard" },
            ],
          },
          true,
        ),
      }));
      return id;
    },
    [update],
  );

  const updateDoctorVerification = useCallback(
    (verification: VerificationStep[]) =>
      update((prev) => (prev.doctor ? { ...prev, doctor: { ...prev.doctor, verification } } : prev)),
    [update],
  );

  const saveAutism: CivicDataContextValue["saveAutism"] = useCallback(
    (record) => {
      const id = makeId();
      const submittedAt = new Date().toISOString();
      update((prev) => ({
        ...prev,
        autism: { ...record, claims: prev.autism?.claims ?? [], requestId: id, submittedAt },
        requests: addStored(
          prev,
          {
            id,
            referenceId: makeReference("OAP"),
            serviceId: "autism",
            module: "autism",
            title: `Autism program intake: ${record.intake.childFirstName}`,
            category: "family",
            submittedAt,
            summary: [
              { label: "Urgency", value: record.triage.urgency[0].toUpperCase() + record.triage.urgency.slice(1) },
              {
                label: "Indicative funding",
                value: record.triage.funding ? `$${record.triage.funding.annualAmount.toLocaleString("en-CA")}/year` : "After diagnosis",
              },
            ],
          },
          true,
        ),
      }));
      return id;
    },
    [update],
  );

  const addClaim: CivicDataContextValue["addClaim"] = useCallback(
    (claim) =>
      update((prev) =>
        prev.autism
          ? { ...prev, autism: { ...prev.autism, claims: [{ ...claim, id: makeId(), status: "submitted" }, ...prev.autism.claims] } }
          : prev,
      ),
    [update],
  );

  const setClaimStatus = useCallback(
    (claimId: string, status: ClaimStatus) =>
      update((prev) =>
        prev.autism
          ? { ...prev, autism: { ...prev.autism, claims: prev.autism.claims.map((c) => (c.id === claimId ? { ...c, status } : c)) } }
          : prev,
      ),
    [update],
  );

  const withdrawRequest = useCallback(
    (requestId: string) =>
      update((prev) => {
        const removed = prev.requests.find((r) => r.id === requestId);
        return {
          ...prev,
          requests: prev.requests.filter((r) => r.id !== requestId),
          housing: removed?.module === "housing" ? null : prev.housing,
          doctor: removed?.module === "doctor" ? null : prev.doctor,
          autism: removed?.module === "autism" ? null : prev.autism,
        };
      }),
    [update],
  );

  const markNotificationsRead = useCallback(
    (ids: string[]) =>
      update((prev) => ({ ...prev, readNotifications: [...new Set([...prev.readNotifications, ...ids])] })),
    [update],
  );

  const seedDemo = useCallback(() => update((prev) => buildDemoData(prev)), [update]);

  const clearDemo = useCallback(
    () =>
      update((prev) => {
        const demoIds = new Set(prev.requests.filter((r) => r.demo).map((r) => r.id));
        return {
          ...prev,
          requests: prev.requests.filter((r) => !r.demo),
          housing: prev.housing && demoIds.has(prev.housing.requestId) ? null : prev.housing,
          doctor: prev.doctor && demoIds.has(prev.doctor.requestId) ? null : prev.doctor,
          autism: prev.autism && demoIds.has(prev.autism.requestId) ? null : prev.autism,
        };
      }),
    [update],
  );

  const requests = useMemo(
    () =>
      data.requests.map((stored) => {
        const { action, holdAt } = actionFor(stored, data);
        return materializeRequest(stored, action, holdAt);
      }),
    [data],
  );

  const value: CivicDataContextValue = {
    userKey,
    signedIn,
    displayName: signedIn ? (user?.given_name ?? user?.name ?? user?.nickname ?? null) : null,
    emailVerified: Boolean(signedIn && user?.email_verified),
    data,
    requests,
    location,
    setLocation,
    submitServiceRequest,
    saveHousing,
    toggleHousingDocument,
    saveDoctor,
    updateDoctorVerification,
    saveAutism,
    addClaim,
    setClaimStatus,
    withdrawRequest,
    markNotificationsRead,
    seedDemo,
    clearDemo,
  };

  return <CivicDataContext.Provider value={value}>{children}</CivicDataContext.Provider>;
}
