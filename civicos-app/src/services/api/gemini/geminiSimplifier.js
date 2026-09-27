/**
 * Plain-language explainer: rewrites a service's eligibility, documents and
 * timing as three grade-8 bullets in the citizen's language.
 */

import { callGeminiTask } from "./geminiClient";

const cache = new Map();

/**
 * @param {{ id: string, title: string, tier: string, agency: string, summary: string,
 *           plainLanguage: string, requirements: string[], time: string }} service
 * @param {"en" | "fr" | "iu" | "oj"} targetLang
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<{ whoQualifies: string, documents: string, timeAndFees: string }>}
 */
export async function simplifyServicePolicy(service, targetLang = "en", { signal } = {}) {
  const key = `${service.id}:${targetLang}`;
  if (cache.has(key)) return cache.get(key);

  const payload = {
    lang: targetLang,
    service: {
      title: service.title,
      tier: service.tier,
      agency: service.agency,
      summary: service.summary,
      plainLanguage: service.plainLanguage,
      requirements: service.requirements,
      time: service.time,
    },
  };
  const raw = await callGeminiTask("simplify", payload, { signal });

  const text = (value) => (typeof value === "string" ? value.trim() : "");
  const result = { whoQualifies: text(raw.whoQualifies), documents: text(raw.documents), timeAndFees: text(raw.timeAndFees) };
  if (Object.values(result).some(Boolean)) cache.set(key, result);
  return result;
}

/** The catalog's own wording, used when the AI is unavailable. Always English source text. */
export const fallbackPolicySummary = (service) => ({
  whoQualifies: service.plainLanguage || service.summary,
  documents: service.requirements.join("; "),
  timeAndFees: service.time,
});
