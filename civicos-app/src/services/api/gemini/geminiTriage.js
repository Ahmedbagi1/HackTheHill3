/**
 * Life-event triage: turns an open-ended situation ("I lost my wallet on the
 * bus") into guidance, an ordered action plan and catalog services across
 * federal, provincial and municipal governments.
 */

import { callGeminiTask, GeminiError } from "./geminiClient";

export const URGENCY_LEVELS = ["Immediate", "High", "Standard"];

/** Triage is offered for descriptions rather than keywords. */
export const isTriageQuery = (query) => query.trim().split(/\s+/).filter(Boolean).length > 3;

/**
 * @param {string} userQuery
 * @param {Array<{ id: string, tier: string, title: string, summary: string }>} servicesCatalog
 * @param {"en" | "fr" | "iu" | "oj"} currentLang
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<{
 *   guidance: string,
 *   recommendedServiceIds: string[],
 *   actionPlan: Array<{ title: string, serviceId: string | null }>,
 *   urgency: "Immediate" | "High" | "Standard",
 * }>}
 */
export async function triageCivicNeed(userQuery, servicesCatalog, currentLang = "en", { signal } = {}) {
  const query = userQuery.trim();
  if (!query) throw new GeminiError("Describe your situation first.", "BAD_REQUEST");

  const catalog = servicesCatalog.map(({ id, tier, title, summary }) => ({ id, tier, title, summary }));
  const raw = await callGeminiTask("triage", { query, catalog, lang: currentLang }, { signal });

  // The model is constrained by a schema, but ids are re-checked so a card can never point at a missing service.
  const known = new Set(catalog.map((s) => s.id));
  const recommendedServiceIds = [
    ...new Set((Array.isArray(raw.recommendedServiceIds) ? raw.recommendedServiceIds : []).filter((id) => known.has(id))),
  ];
  const actionPlan = (Array.isArray(raw.actionPlan) ? raw.actionPlan : [])
    .map((step) => ({
      title: typeof step?.title === "string" ? step.title.trim() : "",
      serviceId: typeof step?.serviceId === "string" && known.has(step.serviceId) ? step.serviceId : null,
    }))
    .filter((step) => step.title);
  const guidance = typeof raw.guidance === "string" ? raw.guidance.trim() : "";
  const urgency = URGENCY_LEVELS.includes(raw.urgency) ? raw.urgency : "Standard";

  if (!guidance && !recommendedServiceIds.length) {
    throw new GeminiError("The AI couldn't match that situation to a service.", "EMPTY");
  }
  return { guidance, recommendedServiceIds, actionPlan, urgency };
}
