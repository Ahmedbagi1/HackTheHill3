import type {
  OapAgeBand,
  PeerResource,
  ServiceProvider,
  SupportNeedsLevel,
  TherapyType,
} from "../../types/autism";

/**
 * Ontario Autism Program core clinical services annual funding by age band and
 * support-needs level. Source: ontario.ca, "Ontario Autism Program guidelines:
 * core clinical services and supports". Age is the child's age on January 1
 * of the year of the determination-of-needs interview.
 */
export const OAP_FUNDING: Record<OapAgeBand, Partial<Record<SupportNeedsLevel, number>>> = {
  "up-to-3": { limited: 10900, moderate: 10900, extensive: 65000 },
  "4-9": { limited: 8900, moderate: 24500, "moderate-plus": 36800, extensive: 65000 },
  "10-14": { limited: 7600, moderate: 18800, extensive: 41400 },
  "15-17": { limited: 6600, moderate: 18300, extensive: 31900 },
};

/** Allocations above this are paid in installments of at most this amount. */
export const OAP_INSTALLMENT_CAP = 25000;

/** Caregiver-mediated early years programs serve children 12 to 48 months old. */
export const EARLY_YEARS_MONTHS = { min: 12, max: 48 };

export const OAP_MAX_AGE = 18;

export const ACCESS_OAP_URL = "https://www.accessoap.ca/";
export const OAP_URL = "https://www.ontario.ca/page/ontario-autism-program";

export const THERAPY_LABELS: Record<TherapyType, string> = {
  aba: "Applied behaviour analysis",
  "speech-language": "Speech-language pathology",
  occupational: "Occupational therapy",
  "mental-health": "Mental health services",
};

/**
 * ILLUSTRATIVE PROVIDERS. Fictional entries that demonstrate the provider view.
 * Families should confirm providers through AccessOAP and the relevant
 * regulatory college before booking.
 */
export const PROVIDERS: ServiceProvider[] = [
  { id: "p1", name: "Bright Path Behaviour Services", therapies: ["aba"], neighbourhood: "Nepean", languages: ["English", "French"], acceptingClients: true, verified: true, sample: true },
  { id: "p2", name: "Clear Voice Speech Therapy", therapies: ["speech-language"], neighbourhood: "Centretown", languages: ["English", "Arabic"], acceptingClients: true, verified: true, sample: true },
  { id: "p3", name: "Little Steps Occupational Therapy", therapies: ["occupational"], neighbourhood: "Orléans", languages: ["English", "French"], acceptingClients: false, verified: true, sample: true },
  { id: "p4", name: "Harbour Family Counselling", therapies: ["mental-health"], neighbourhood: "Westboro", languages: ["English"], acceptingClients: true, verified: true, sample: true },
  { id: "p5", name: "Kanata Child Development Clinic", therapies: ["aba", "occupational", "speech-language"], neighbourhood: "Kanata", languages: ["English", "Mandarin"], acceptingClients: true, verified: true, sample: true },
  { id: "p6", name: "Riverside Sensory & Motor Clinic", therapies: ["occupational"], neighbourhood: "Riverside South", languages: ["English", "Somali"], acceptingClients: true, verified: false, sample: true },
  { id: "p7", name: "Capital Communication Collective", therapies: ["speech-language", "aba"], neighbourhood: "Vanier", languages: ["French", "English"], acceptingClients: true, verified: true, sample: true },
];

/** Real organisations serving autistic children and their families in Ontario. */
export const PEER_RESOURCES: PeerResource[] = [
  {
    id: "autism-ontario",
    name: "Autism Ontario",
    description: "Parent peer support, social and recreation programs, and system navigation.",
    url: "https://www.autismontario.com/",
    kind: "peer-support",
  },
  {
    id: "accessoap",
    name: "AccessOAP",
    description: "Registers families for the Ontario Autism Program and assigns care coordinators.",
    url: ACCESS_OAP_URL,
    kind: "navigation",
  },
  {
    id: "earlyon",
    name: "EarlyON Child and Family Centres",
    description: "Free drop-in programs for children up to age 6 and their caregivers.",
    url: "https://www.ontario.ca/page/find-earlyon-child-and-family-centre",
    kind: "early-years",
  },
  {
    id: "211",
    name: "2-1-1 Ontario",
    description: "Find local community, respite and caregiver services. Call or text 2-1-1.",
    url: "https://211ontario.ca/",
    kind: "navigation",
  },
];
