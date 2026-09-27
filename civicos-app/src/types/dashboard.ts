/**
 * Dashboard domain models: province, requests, waste schedule, disruptions,
 * news and notifications.
 */

/* ------------------------------------------------------------------ */
/* Location                                                            */
/* ------------------------------------------------------------------ */

export type ProvinceCode =
  | "AB" | "BC" | "MB" | "NB" | "NL" | "NS" | "NT" | "NU" | "ON" | "PE" | "QC" | "SK" | "YT";

export interface Province {
  code: ProvinceCode;
  name: string;
  /** CBC regional RSS slugs used for provincial news. */
  newsFeeds: string[];
  /** True when CivicOS has provincial + municipal services for this province. */
  fullCoverage: boolean;
}

export type LocationSource = "default" | "detected" | "manual";

export interface LocationPreference {
  province: ProvinceCode;
  source: LocationSource;
  /** Saved street address used for the waste schedule and nearby disruptions. */
  address?: string;
}

/* ------------------------------------------------------------------ */
/* Service categories                                                  */
/* ------------------------------------------------------------------ */

export type ServiceCategoryId =
  | "housing"
  | "health"
  | "family"
  | "utilities"
  | "transportation"
  | "money"
  | "identity"
  | "work"
  | "community";

export interface ServiceCategory {
  id: ServiceCategoryId;
  label: string;
  description: string;
}

/* ------------------------------------------------------------------ */
/* User requests & tracking                                            */
/* ------------------------------------------------------------------ */

export type RequestStageState = "done" | "current" | "upcoming" | "blocked";

export interface RequestStage {
  key: string;
  label: string;
  /** Typical duration of this stage in days, used for the ETA. */
  typicalDays: number;
  state: RequestStageState;
  /** ISO date this stage completed (done) or is expected to complete (current/upcoming). */
  date?: string;
}

export type RequestActionKind = "documents" | "verification" | "respond" | "review";

export interface RequestAction {
  kind: RequestActionKind;
  label: string;
  detail: string;
}

export type RequestModuleId = "housing" | "doctor" | "autism" | "service";

export interface UserRequest {
  id: string;
  referenceId: string;
  /** Catalog service id (servicesData.js) or module id. */
  serviceId: string;
  module: RequestModuleId;
  title: string;
  category: ServiceCategoryId;
  submittedAt: string;
  stages: RequestStage[];
  /** Index into stages of the current stage. */
  currentStage: number;
  estimatedCompletion?: string;
  actionRequired?: RequestAction;
  /** Waitlist position when the program uses a queue. */
  waitlistPosition?: number;
  /** Free-form structured details shown in the tracker. */
  summary: Array<{ label: string; value: string }>;
  /** Stage progress is simulated from typical durations (no government backend). */
  simulated: true;
  /** Seeded demo record rather than something the user submitted. */
  demo?: boolean;
}

/* ------------------------------------------------------------------ */
/* Waste schedule                                                      */
/* ------------------------------------------------------------------ */

export type WasteStream = "green" | "garbage" | "blue" | "black" | "yard";

export interface WasteRotation {
  /** Recycling cart collected on the anchor date. */
  anchorRecycling: "blue" | "black";
  /** Whether garbage is collected on the anchor date. */
  anchorGarbage: boolean;
  /** ISO date (YYYY-MM-DD) of the collection day the user described. */
  anchorDate: string;
}

export interface WasteCollectionDay {
  date: string;
  streams: WasteStream[];
  /** Streams we can't place on a specific week until the rotation is set. */
  uncertain: WasteStream[];
}

export interface WasteSchedule {
  address: string;
  weekday: string;
  zone: string;
  schedule: string;
  multiResidential: boolean;
  upcoming: WasteCollectionDay[];
  rotationKnown: boolean;
}

/* ------------------------------------------------------------------ */
/* Civic pulse: disruptions                                            */
/* ------------------------------------------------------------------ */

export type Severity = "critical" | "moderate" | "advisory";

export type DisruptionKind = "power" | "road" | "transit" | "water";

export interface Disruption {
  id: string;
  kind: DisruptionKind;
  severity: Severity;
  title: string;
  detail: string;
  source: string;
  sourceUrl?: string;
  updatedAt?: string;
  startsAt?: string;
  endsAt?: string;
  location?: { lat: number; lon: number };
  /** Distance from the user's saved address, when known. */
  distanceKm?: number;
}

export type FeedStatus = "live" | "unavailable" | "no-feed";

export interface DisruptionFeedSource {
  kind: DisruptionKind;
  label: string;
  status: FeedStatus;
  sourceUrl: string;
  note?: string;
}

export interface DisruptionFeed {
  items: Disruption[];
  sources: DisruptionFeedSource[];
  fetchedAt: string;
  power?: { outages: number; customersAffected: string; customersServed: number };
}

/* ------------------------------------------------------------------ */
/* News                                                                */
/* ------------------------------------------------------------------ */

export type NewsScope = "national" | "provincial";

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  category: string;
  scope: NewsScope;
  publishedAt: string;
}

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

export interface DashboardNotification {
  id: string;
  tone: Severity | "info";
  /** English source text, translated at display time unless `sourceText` is set. */
  title: string;
  detail: string;
  /** Prefix shown before the detail, e.g. the request's service name. */
  context?: string;
  /** Items joined into the detail line, each translated separately. */
  detailParts?: string[];
  /** Title and detail come from a third-party feed and stay in their source language (English). */
  sourceText?: boolean;
  actionLabel?: string;
  target?: { type: "request"; id: string } | { type: "module"; id: RequestModuleId } | { type: "anchor"; id: string };
}

export interface EmergencyNotice {
  id: string;
  severity: Severity;
  title: string;
  text: string;
  sourceUrl?: string;
}
