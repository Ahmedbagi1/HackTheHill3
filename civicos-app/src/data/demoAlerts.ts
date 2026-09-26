import type { RegionalAlert } from "../types/alerts";

const HOUR = 60 * 60 * 1000;

/**
 * Sample agency notices for demos. These agencies publish no machine-readable
 * status feed, so the notices are illustrative: they appear only while demo
 * data is loaded and every card is tagged "Demo".
 */
export function buildDemoAgencyAlerts(now = Date.now()): RegionalAlert[] {
  // Whole hours read like real notices ("until 4:00 p.m."), not "4:43 p.m.".
  const at = (hours: number) => new Date(Math.round((now + hours * HOUR) / HOUR) * HOUR).toISOString();
  const sample = (alert: Omit<RegionalAlert, "demo" | "updatedAt"> & { updatedHoursAgo: number }): RegionalAlert => {
    const { updatedHoursAgo, ...rest } = alert;
    return { ...rest, updatedAt: at(-updatedHoursAgo), demo: true };
  };

  return [
    sample({
      id: "demo-saaq-outage",
      jurisdiction: "QC",
      agency: "SAAQ",
      agencyName: "SAAQ / SAAQclic",
      category: "service-outage",
      severity: "critical",
      title: "SAAQclic sign-in unavailable",
      detail: "Online licence renewals and registration payments can't be completed. Service centres remain open.",
      resolution: { kind: "estimate", at: at(3) },
      sourceUrl: "https://saaq.gouv.qc.ca/en/saaqclic",
      updatedHoursAgo: 0.5,
    }),
    sample({
      id: "demo-icbc-delay",
      jurisdiction: "BC",
      agency: "ICBC",
      agencyName: "ICBC",
      category: "delay",
      severity: "moderate",
      title: "Road test booking is slow",
      detail: "Online booking is taking longer than usual. Existing appointments aren't affected.",
      resolution: { kind: "estimate", at: at(5) },
      sourceUrl: "https://www.icbc.com/",
      updatedHoursAgo: 1,
    }),
    sample({
      id: "demo-serviceontario-maintenance",
      jurisdiction: "ON",
      agency: "ServiceOntario",
      agencyName: "ServiceOntario",
      category: "maintenance",
      severity: "moderate",
      title: "Scheduled maintenance: online renewals",
      detail: "Online health card and driver's licence renewals will be offline during the maintenance window.",
      startsAt: at(18),
      resolution: { kind: "ends", at: at(22) },
      sourceUrl: "https://www.ontario.ca/page/serviceontario",
      updatedHoursAgo: 6,
    }),
    sample({
      id: "demo-metrolinx-delay",
      jurisdiction: "ON",
      agency: "Metrolinx",
      agencyName: "GO Transit (Metrolinx)",
      category: "delay",
      severity: "advisory",
      title: "Lakeshore West trains delayed up to 15 minutes",
      detail: "Signal work near Exhibition station. Allow extra travel time.",
      resolution: { kind: "estimate", at: at(2) },
      sourceUrl: "https://www.gotransit.com/en/service-updates",
      updatedHoursAgo: 0.25,
    }),
    sample({
      id: "demo-cra-maintenance",
      jurisdiction: "FED",
      agency: "CRA",
      agencyName: "Canada Revenue Agency",
      category: "maintenance",
      severity: "moderate",
      title: "My Account scheduled maintenance",
      detail: "My Account, My Business Account and Represent a Client will be unavailable overnight.",
      startsAt: at(9),
      resolution: { kind: "ends", at: at(14) },
      sourceUrl: "https://www.canada.ca/en/revenue-agency.html",
      updatedHoursAgo: 12,
    }),
    sample({
      id: "demo-alberta-registries",
      jurisdiction: "AB",
      agency: "Registries",
      agencyName: "Alberta registry agents",
      category: "delay",
      severity: "advisory",
      title: "Longer waits at registry agent offices",
      detail: "A motor vehicle system slowdown means 30 to 45 minute waits for licence and registration transactions.",
      resolution: { kind: "estimate", at: at(6) },
      sourceUrl: "https://www.alberta.ca/registry-services",
      updatedHoursAgo: 2,
    }),
    sample({
      id: "demo-ramq-advisory",
      jurisdiction: "QC",
      agency: "RAMQ",
      agencyName: "Régie de l'assurance maladie du Québec",
      category: "delay",
      severity: "advisory",
      title: "Health card renewal notices arriving late",
      detail: "Renewal letters are delayed by mail processing. You can renew online without the letter.",
      resolution: { kind: "ongoing", note: "No end date announced" },
      sourceUrl: "https://www.ramq.gouv.qc.ca/en",
      updatedHoursAgo: 20,
    }),
  ];
}
