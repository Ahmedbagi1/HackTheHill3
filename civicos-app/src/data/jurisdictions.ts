import type { AgencyStatusLink, JurisdictionCode } from "../types/alerts";
import type { ProvinceCode } from "../types/dashboard";
import type { ProvincialPortal } from "../types/directory";

/**
 * Official services and status pages by jurisdiction. Every URL was checked
 * (HTTP 200) in September 2026; gov.nu.ca blocks automated checks but is the
 * Government of Nunavut's official domain.
 */

/** Official provincial/territorial services for places outside CivicOS's Ontario catalog. */
export const PROVINCIAL_PORTALS: ProvincialPortal[] = [
  // Quebec
  { id: "qc-saaq", province: "QC", title: "Driver's licence & vehicle registration", agency: "SAAQ", summary: "Licences, plates, registration and road tests with the Société de l'assurance automobile du Québec.", url: "https://saaq.gouv.qc.ca/en/", category: "transportation" },
  { id: "qc-saaqclic", province: "QC", title: "SAAQclic online services", agency: "SAAQ", summary: "Renew a licence, pay registration and book appointments online.", url: "https://saaq.gouv.qc.ca/en/saaqclic", category: "identity" },
  { id: "qc-ramq", province: "QC", title: "Health insurance card", agency: "RAMQ", summary: "Register for Québec health insurance and renew your health insurance card.", url: "https://www.ramq.gouv.qc.ca/en/citizens/health-insurance", category: "health" },
  // British Columbia
  { id: "bc-icbc", province: "BC", title: "Driver licensing & vehicle insurance", agency: "ICBC", summary: "Road tests, licence renewals, vehicle insurance and claims.", url: "https://www.icbc.com/", category: "transportation" },
  { id: "bc-services-card", province: "BC", title: "BC Services Card", agency: "Government of BC", summary: "Photo ID and health coverage card, and secure login for provincial services.", url: "https://www2.gov.bc.ca/gov/content/governments/government-id/bc-services-card", category: "identity" },
  { id: "bc-msp", province: "BC", title: "Medical Services Plan (MSP)", agency: "Government of BC", summary: "Enrol in and update your provincial health coverage.", url: "https://www2.gov.bc.ca/gov/content/health/health-drug-coverage/msp", category: "health" },
  // Alberta
  { id: "ab-registry", province: "AB", title: "Registry services", agency: "Alberta Registries", summary: "Driver's licences, ID cards, vehicle registration and vital statistics through registry agents.", url: "https://www.alberta.ca/registry-services", category: "identity" },
  { id: "ab-ahcip", province: "AB", title: "Alberta Health Care Insurance Plan", agency: "Alberta Health", summary: "Apply for coverage and get or replace your health card.", url: "https://www.alberta.ca/ahcip", category: "health" },
  // Manitoba
  { id: "mb-mpi", province: "MB", title: "Driver's licence & vehicle insurance", agency: "MPI", summary: "Licences, registration and Autopac with Manitoba Public Insurance.", url: "https://www.mpi.mb.ca/", category: "transportation" },
  { id: "mb-health", province: "MB", title: "Manitoba Health card", agency: "Manitoba Health", summary: "Register for coverage and update your health card.", url: "https://www.gov.mb.ca/health/mhsip/", category: "health" },
  // Saskatchewan
  { id: "sk-sgi", province: "SK", title: "Driver's licence & vehicle registration", agency: "SGI", summary: "Licences, plates and registration with Saskatchewan Government Insurance.", url: "https://www.sgi.sk.ca/", category: "transportation" },
  { id: "sk-ehealth", province: "SK", title: "Health cards & vital statistics", agency: "eHealth Saskatchewan", summary: "Health cards, birth, marriage and death certificates.", url: "https://www.ehealthsask.ca/", category: "health" },
  // Nova Scotia
  { id: "ns-rmv", province: "NS", title: "Registry of Motor Vehicles", agency: "Service Nova Scotia", summary: "Driver's licences, ID cards and vehicle permits.", url: "https://novascotia.ca/sns/rmv/", category: "transportation" },
  { id: "ns-msi", province: "NS", title: "MSI health card", agency: "Nova Scotia Health", summary: "Register for Medical Services Insurance and renew your health card.", url: "https://novascotia.ca/dhw/msi/", category: "health" },
  // New Brunswick
  { id: "nb-snb", province: "NB", title: "Service New Brunswick", agency: "SNB", summary: "Driver's licences, Medicare cards, vital statistics and property services.", url: "https://www2.snb.ca/", category: "identity" },
  // Newfoundland and Labrador
  { id: "nl-mrd", province: "NL", title: "Motor Registration", agency: "Digital Government and Service NL", summary: "Driver's licences, vehicle registration and online renewals.", url: "https://www.gov.nl.ca/motorregistration/", category: "transportation" },
  { id: "nl-mcp", province: "NL", title: "Medical Care Plan (MCP)", agency: "Health and Community Services", summary: "Register for coverage and replace your MCP card.", url: "https://www.gov.nl.ca/hcs/mcp/", category: "health" },
  // Prince Edward Island
  { id: "pe-access", province: "PE", title: "Access PEI", agency: "Government of PEI", summary: "Driver's licences, vehicle registration, health cards and ID.", url: "https://www.princeedwardisland.ca/en/topic/access-pei", category: "identity" },
  { id: "pe-health", province: "PE", title: "Health PEI", agency: "Health PEI", summary: "Health services, clinics and the provincial health card.", url: "https://www.princeedwardisland.ca/en/topic/health-pei", category: "health" },
  // Territories
  { id: "yt-driving", province: "YT", title: "Driving & transportation", agency: "Government of Yukon", summary: "Driver's licences, vehicle registration and road information.", url: "https://yukon.ca/en/driving-and-transportation", category: "transportation" },
  { id: "yt-health", province: "YT", title: "Health & wellness", agency: "Government of Yukon", summary: "Health care cards, insurance and health services.", url: "https://yukon.ca/en/health-and-wellness", category: "health" },
  { id: "nt-licences", province: "NT", title: "Driver's licences", agency: "NWT Infrastructure", summary: "Apply for, renew or replace a Northwest Territories driver's licence.", url: "https://www.inf.gov.nt.ca/en/services/drivers-licences", category: "transportation" },
  { id: "nt-health", province: "NT", title: "Health and Social Services", agency: "NWT Health and Social Services", summary: "Health care plan, cards and community health services.", url: "https://www.hss.gov.nt.ca/en", category: "health" },
  { id: "nu-gov", province: "NU", title: "Government of Nunavut services", agency: "Government of Nunavut", summary: "Driver's licences, health cards and territorial programs.", url: "https://www.gov.nu.ca/", category: "identity" },
];

export const portalsFor = (province: ProvinceCode): ProvincialPortal[] => PROVINCIAL_PORTALS.filter((p) => p.province === province);

/** Agencies with no public machine-readable status feed. */
export const AGENCY_STATUS_LINKS: AgencyStatusLink[] = [
  { jurisdiction: "FED", agency: "CRA", agencyName: "Canada Revenue Agency", covers: "My Account, tax filing, benefits", url: "https://www.canada.ca/en/revenue-agency.html" },
  { jurisdiction: "FED", agency: "IRCC", agencyName: "Immigration, Refugees and Citizenship Canada", covers: "Passports, PR, citizenship", url: "https://www.canada.ca/en/immigration-refugees-citizenship.html" },
  { jurisdiction: "FED", agency: "Service Canada", agencyName: "Service Canada", covers: "EI, CPP/OAS, SIN", url: "https://www.canada.ca/en/employment-social-development/corporate/portfolio/service-canada.html" },
  { jurisdiction: "ON", agency: "ServiceOntario", agencyName: "ServiceOntario", covers: "Licences, health cards, registrations", url: "https://www.ontario.ca/page/serviceontario" },
  { jurisdiction: "ON", agency: "Metrolinx", agencyName: "GO Transit (Metrolinx)", covers: "GO train and bus service", url: "https://www.gotransit.com/en/service-updates" },
  { jurisdiction: "ON", agency: "Health811", agencyName: "Health811", covers: "Nurse advice and health navigation", url: "https://health811.ontario.ca/" },
  { jurisdiction: "QC", agency: "SAAQ", agencyName: "SAAQ / SAAQclic", covers: "Licences, registration, online services", url: "https://saaq.gouv.qc.ca/en/saaqclic" },
  { jurisdiction: "QC", agency: "RAMQ", agencyName: "Régie de l'assurance maladie du Québec", covers: "Health insurance card", url: "https://www.ramq.gouv.qc.ca/en" },
  { jurisdiction: "QC", agency: "Québec 511", agencyName: "Québec 511", covers: "Road conditions and closures", url: "https://www.quebec511.info/en/" },
  { jurisdiction: "BC", agency: "ICBC", agencyName: "ICBC", covers: "Road tests, licensing, claims", url: "https://www.icbc.com/" },
  { jurisdiction: "BC", agency: "BC Services Card", agencyName: "BC Services Card", covers: "ID, health coverage, login", url: "https://www2.gov.bc.ca/gov/content/governments/government-id/bc-services-card" },
  { jurisdiction: "AB", agency: "Registries", agencyName: "Alberta registry agents", covers: "Licences, IDs, vehicle registration", url: "https://www.alberta.ca/registry-services" },
  { jurisdiction: "AB", agency: "AHS", agencyName: "Alberta Health Services", covers: "Hospitals, clinics, wait times", url: "https://www.albertahealthservices.ca/" },
  { jurisdiction: "AB", agency: "511 Alberta", agencyName: "511 Alberta", covers: "Road conditions and closures", url: "https://511.alberta.ca/" },
  { jurisdiction: "MB", agency: "MPI", agencyName: "Manitoba Public Insurance", covers: "Licensing and Autopac", url: "https://www.mpi.mb.ca/" },
  { jurisdiction: "MB", agency: "Manitoba 511", agencyName: "Manitoba 511", covers: "Road conditions and closures", url: "https://www.manitoba511.ca/" },
  { jurisdiction: "SK", agency: "SGI", agencyName: "Saskatchewan Government Insurance", covers: "Licensing and registration", url: "https://www.sgi.sk.ca/" },
  { jurisdiction: "SK", agency: "Highway Hotline", agencyName: "Saskatchewan Highway Hotline", covers: "Road conditions", url: "https://hotline.gov.sk.ca/" },
  { jurisdiction: "NS", agency: "RMV", agencyName: "Registry of Motor Vehicles", covers: "Licences and permits", url: "https://novascotia.ca/sns/rmv/" },
  { jurisdiction: "NS", agency: "511 NS", agencyName: "511 Nova Scotia", covers: "Road conditions and closures", url: "https://511.novascotia.ca/" },
  { jurisdiction: "NB", agency: "SNB", agencyName: "Service New Brunswick", covers: "Licences, Medicare, vital statistics", url: "https://www2.snb.ca/" },
  { jurisdiction: "NB", agency: "511 NB", agencyName: "511 New Brunswick", covers: "Road conditions and closures", url: "https://511.gnb.ca/" },
  { jurisdiction: "NL", agency: "Motor Registration", agencyName: "Motor Registration Division", covers: "Licences and registration", url: "https://www.gov.nl.ca/motorregistration/" },
  { jurisdiction: "NL", agency: "511 NL", agencyName: "511 Newfoundland and Labrador", covers: "Road conditions and closures", url: "https://511nl.ca/" },
  { jurisdiction: "PE", agency: "Access PEI", agencyName: "Access PEI", covers: "Licences, registration, health cards", url: "https://www.princeedwardisland.ca/en/topic/access-pei" },
  { jurisdiction: "YT", agency: "511 Yukon", agencyName: "511 Yukon", covers: "Road conditions and closures", url: "https://511yukon.ca/" },
  { jurisdiction: "NT", agency: "Infrastructure", agencyName: "NWT Infrastructure", covers: "Highways, ferries, licensing", url: "https://www.inf.gov.nt.ca/en/transportation" },
  { jurisdiction: "NU", agency: "GN", agencyName: "Government of Nunavut", covers: "Territorial services", url: "https://www.gov.nu.ca/" },
];

export const JURISDICTION_LABEL: Record<JurisdictionCode, string> = {
  FED: "Federal",
  AB: "Alberta",
  BC: "British Columbia",
  MB: "Manitoba",
  NB: "New Brunswick",
  NL: "Newfoundland and Labrador",
  NS: "Nova Scotia",
  NT: "Northwest Territories",
  NU: "Nunavut",
  ON: "Ontario",
  PE: "Prince Edward Island",
  QC: "Quebec",
  SK: "Saskatchewan",
  YT: "Yukon",
};
