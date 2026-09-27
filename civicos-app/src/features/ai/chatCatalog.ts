import { SERVICES, SERVICES_BY_ID } from "../../data/servicesData";
import type { ModuleRoute } from "../../state/useHashRoute";

/** Primary-step radio fields that choose a wizard branch (e.g. LTB T2 vs T6). */
const BRANCH_FIELDS = ["applicationType", "requestType", "projectType", "passType", "incidentType", "certificateType"];

export interface ChatCatalogItem {
  id: string;
  tier: string;
  title: string;
  summary: string;
  options?: Array<{ value: string; label: string }>;
}

interface FieldOption {
  value: string;
  label: string;
  hint?: string;
}
interface BranchField {
  name: string;
  type: string;
  options?: FieldOption[];
}

/** The three guided programs that live outside the service catalog. */
export const CHAT_MODULES: Array<ChatCatalogItem & { id: ModuleRoute; keywords: string[] }> = [
  {
    id: "housing",
    tier: "Provincial",
    title: "Subsidized housing (RGI)",
    summary: "Rent-geared-to-income housing: eligibility, priority status and application tracking with The Social Housing Registry of Ottawa.",
    keywords: ["rgi", "subsidized housing", "social housing", "affordable housing", "can't afford rent", "homeless", "shelter", "housing"],
  },
  {
    id: "doctor",
    tier: "Provincial",
    title: "Find a family doctor",
    summary: "Match with family doctors and nurse practitioners accepting patients, and register with Health Care Connect.",
    keywords: ["family doctor", "doctor", "physician", "nurse practitioner", "health care connect", "no doctor"],
  },
  {
    id: "autism",
    tier: "Provincial",
    title: "Autism support (Ontario Autism Program)",
    summary: "Ontario Autism Program pathways, funding and therapies for children and youth under 18.",
    keywords: ["autism", "autistic", "asd", "oap", "diagnosis", "therapy", "child development"],
  },
];

const MODULE_IDS = new Set<string>(CHAT_MODULES.map((m) => m.id));
export const isModuleId = (id: string): id is ModuleRoute => MODULE_IDS.has(id);

/** The branch field a service's wizard starts with, if any. */
export function branchFieldOf(serviceId: string): BranchField | undefined {
  const service = (SERVICES_BY_ID as Record<string, { form: { primary: { fields: BranchField[] } } } | undefined>)[serviceId];
  return service?.form.primary.fields.find((field) => field.type === "radio" && BRANCH_FIELDS.includes(field.name) && field.options?.length);
}

export const CHAT_CATALOG: ChatCatalogItem[] = [
  ...SERVICES.map(({ id, tier, title, summary }: { id: string; tier: string; title: string; summary: string }) => {
    const branch = branchFieldOf(id);
    return {
      id,
      tier,
      title,
      summary,
      ...(branch && {
        options: branch.options!.map((option) => ({ value: option.value, label: option.hint ? `${option.label} (${option.hint})` : option.label })),
      }),
    };
  }),
  ...CHAT_MODULES.map(({ id, tier, title, summary }) => ({ id, tier, title, summary })),
];

const normalize = (text: string) => text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Offline fallback when Gemini isn't available: ranks catalog entries by how
 * many of their search keywords appear in the message.
 */
export function keywordMatches(message: string, limit = 3): string[] {
  const text = normalize(message);
  const score = (keywords: string[], title: string) =>
    keywords.reduce((sum, keyword) => sum + (text.includes(normalize(keyword)) ? keyword.split(" ").length : 0), 0) +
    (text.includes(normalize(title)) ? 2 : 0);
  return [
    ...SERVICES.map((s: { id: string; keywords: string[]; title: string }) => ({ id: s.id, score: score(s.keywords, s.title) })),
    ...CHAT_MODULES.map((m) => ({ id: m.id, score: score(m.keywords, m.title) })),
  ]
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((match) => match.id);
}
