import type { ProvinceCode, Severity } from "./dashboard";

/** A province/territory, or the federal government. */
export type JurisdictionCode = ProvinceCode | "FED";

/** Region filter in the alerts panel. */
export type AlertRegion = JurisdictionCode | "ALL";

/**
 * What kind of disruption an alert describes. Severity (critical / moderate /
 * advisory) is tracked separately so a planned maintenance window and an
 * unplanned outage can carry the same urgency scale.
 */
export type AlertCategory = "service-outage" | "maintenance" | "delay" | "power" | "road" | "weather";

export interface AlertResolution {
  /**
   * - `ends`: the source publishes an end time (weather alert end, road closure window)
   * - `estimate`: the operator's estimated restoration time
   * - `ongoing`: no end time or estimate published yet
   */
  kind: "ends" | "estimate" | "ongoing";
  at?: string;
  /** Plain-language status when there's no timestamp, e.g. "Crew on site". */
  note?: string;
}

export interface RegionalAlert {
  id: string;
  jurisdiction: JurisdictionCode;
  /** Short agency label shown in the badge, e.g. "SAAQ", "ECCC", "BC Hydro". */
  agency: string;
  agencyName: string;
  category: AlertCategory;
  severity: Severity;
  title: string;
  detail: string;
  /** Affected area, when the source names one. */
  area?: string;
  startsAt?: string;
  updatedAt?: string;
  resolution: AlertResolution;
  sourceUrl: string;
  /** Sample notice shown only while demo data is loaded. */
  demo?: boolean;
}

export interface AlertSource {
  id: string;
  label: string;
  /** Jurisdictions the source covers. */
  coverage: JurisdictionCode[];
  status: "live" | "unavailable";
  sourceUrl: string;
}

export interface RegionalAlertFeed {
  items: RegionalAlert[];
  sources: AlertSource[];
  fetchedAt: string;
}

/**
 * An agency without a public status feed. The panel links to its official
 * page instead of inventing a status.
 */
export interface AgencyStatusLink {
  jurisdiction: JurisdictionCode;
  agency: string;
  agencyName: string;
  covers: string;
  url: string;
}
