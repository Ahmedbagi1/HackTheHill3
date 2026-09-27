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
 * @param {Array<{ id: string, tier: string, title: string, summary: string, options?: Array<{ value: string, label: string }> }>} servicesCatalog
 *   `options` are the first-step choices of a service's wizard (e.g. LTB T2 / T6), so a step can open the right branch.
 * @param {"en" | "fr" | "iu" | "oj"} currentLang
 * @param {{ signal?: AbortSignal, history?: string[] }} [options]  `history`: earlier messages in the same chat, oldest first
 * @returns {Promise<{
 *   guidance: string,
 *   recommendedServiceIds: string[],
 *   actionPlan: Array<{ title: string, serviceId: string | null, option: string | null }>,
 *   urgency: "Immediate" | "High" | "Standard",
 * }>}
 */
export async function triageCivicNeed(userQuery, servicesCatalog, currentLang = "en", { signal, history = [] } = {}) {
  const query = userQuery.trim();
  if (!query) throw new GeminiError("Describe your situation first.", "BAD_REQUEST");

  const catalog = servicesCatalog.map(({ id, tier, title, summary, options }) => ({
    id,
    tier,
    title,
    summary,
    ...(options?.length && { options: options.map(({ value, label }) => ({ value, label })) }),
  }));
  const raw = await callGeminiTask(
    "triage",
    { query, catalog, lang: currentLang, ...(history.length && { history: history.slice(-6) }) },
    { signal },
  );

  // The model is constrained by a schema, but ids are re-checked so a card can never point at a missing service.
  const known = new Set(catalog.map((s) => s.id));
  const optionsById = new Map(catalog.map((s) => [s.id, new Set((s.options ?? []).map((o) => o.value))]));
  const recommendedServiceIds = [
    ...new Set((Array.isArray(raw.recommendedServiceIds) ? raw.recommendedServiceIds : []).filter((id) => known.has(id))),
  ];
  const actionPlan = (Array.isArray(raw.actionPlan) ? raw.actionPlan : [])
    .map((step) => ({
      title: typeof step?.title === "string" ? step.title.trim() : "",
      serviceId: typeof step?.serviceId === "string" && known.has(step.serviceId) ? step.serviceId : null,
      option: typeof step?.option === "string" ? step.option : null,
    }))
    // An option only counts for the service it belongs to.
    .map((step) => ({ ...step, option: step.serviceId && optionsById.get(step.serviceId)?.has(step.option) ? step.option : null }))
    .filter((step) => step.title);
  const guidance = typeof raw.guidance === "string" ? raw.guidance.trim() : "";
  const urgency = URGENCY_LEVELS.includes(raw.urgency) ? raw.urgency : "Standard";

  if (!guidance && !recommendedServiceIds.length) {
    throw new GeminiError("The AI couldn't match that situation to a service.", "EMPTY");
  }
  return { guidance, recommendedServiceIds, actionPlan, urgency };
}
