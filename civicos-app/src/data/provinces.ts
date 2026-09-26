import type { Province, ProvinceCode } from "../types/dashboard";

/**
 * Provinces and territories. `newsFeeds` are CBC regional RSS slugs
 * (https://www.cbc.ca/webfeed/rss/rss-<slug>), each verified September 2026.
 * Only Ontario has provincial + municipal services in CivicOS today.
 */
export const PROVINCES: Province[] = [
  { code: "AB", name: "Alberta", newsFeeds: ["canada-calgary", "canada-edmonton"], fullCoverage: false },
  { code: "BC", name: "British Columbia", newsFeeds: ["canada-britishcolumbia"], fullCoverage: false },
  { code: "MB", name: "Manitoba", newsFeeds: ["canada-manitoba"], fullCoverage: false },
  { code: "NB", name: "New Brunswick", newsFeeds: ["canada-newbrunswick"], fullCoverage: false },
  { code: "NL", name: "Newfoundland and Labrador", newsFeeds: ["canada-newfoundland"], fullCoverage: false },
  { code: "NS", name: "Nova Scotia", newsFeeds: ["canada-novascotia"], fullCoverage: false },
  { code: "NT", name: "Northwest Territories", newsFeeds: ["canada-north"], fullCoverage: false },
  { code: "NU", name: "Nunavut", newsFeeds: ["canada-north"], fullCoverage: false },
  { code: "ON", name: "Ontario", newsFeeds: ["canada-ottawa", "canada-toronto"], fullCoverage: true },
  { code: "PE", name: "Prince Edward Island", newsFeeds: ["canada-pei"], fullCoverage: false },
  { code: "QC", name: "Quebec", newsFeeds: ["canada-montreal"], fullCoverage: false },
  { code: "SK", name: "Saskatchewan", newsFeeds: ["canada-saskatchewan"], fullCoverage: false },
  { code: "YT", name: "Yukon", newsFeeds: ["canada-north"], fullCoverage: false },
];

export const PROVINCES_BY_CODE = Object.fromEntries(PROVINCES.map((p) => [p.code, p])) as Record<ProvinceCode, Province>;

export const DEFAULT_PROVINCE: ProvinceCode = "ON";

/** Maps a Nominatim `state` name (English or French) to a province code. */
export function provinceFromName(name: string | undefined | null): ProvinceCode | null {
  if (!name) return null;
  const normalized = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  const aliases: Record<string, ProvinceCode> = {
    alberta: "AB",
    "british columbia": "BC",
    "colombie-britannique": "BC",
    manitoba: "MB",
    "new brunswick": "NB",
    "nouveau-brunswick": "NB",
    "newfoundland and labrador": "NL",
    "terre-neuve-et-labrador": "NL",
    "nova scotia": "NS",
    "nouvelle-ecosse": "NS",
    "northwest territories": "NT",
    "territoires du nord-ouest": "NT",
    nunavut: "NU",
    ontario: "ON",
    "prince edward island": "PE",
    "ile-du-prince-edouard": "PE",
    quebec: "QC",
    saskatchewan: "SK",
    yukon: "YT",
  };
  return aliases[normalized] ?? null;
}
