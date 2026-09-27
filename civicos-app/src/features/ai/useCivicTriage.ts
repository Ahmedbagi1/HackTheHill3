import { useCallback, useEffect, useState } from "react";
import { SERVICES } from "../../data/servicesData";
import type { Lang } from "../../i18n/i18n";
import { GeminiError, isGeminiDisabled } from "../../services/api/gemini/geminiClient";
import { triageCivicNeed } from "../../services/api/gemini/geminiTriage";

export interface TriageResult {
  guidance: string;
  recommendedServiceIds: string[];
  actionPlan: Array<{ title: string; serviceId: string | null }>;
  urgency: "Immediate" | "High" | "Standard";
}

export type TriageState =
  | { status: "idle" }
  | { status: "loading"; query: string; lang: Lang }
  | { status: "ready"; query: string; lang: Lang; result: TriageResult }
  | { status: "error"; query: string; lang: Lang; message: string; disabled: boolean };

type Outcome =
  | { status: "ready"; result: TriageResult }
  | { status: "error"; message: string; disabled: boolean };

const CATALOG = SERVICES.map(({ id, tier, title, summary }) => ({ id, tier, title, summary }));

const outcomeKey = (query: string, lang: Lang) => `${lang}\u0000${query}`;

/**
 * Gemini life-event triage for the directory search.
 *
 * The citizen requests triage for a query; the answer is fetched per
 * (query, language) and cached, so:
 * - switching language fetches (or reuses) the answer in that language;
 * - editing the search away from the triaged text hides the AI view, so AI
 *   results never sit on top of unrelated keyword results;
 * - a superseded request is aborted.
 */
export function useCivicTriage(currentQuery: string, lang: Lang) {
  const [requestedQuery, setRequestedQuery] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});

  const activeQuery = requestedQuery !== null && currentQuery.trim() === requestedQuery ? requestedQuery : null;
  const key = activeQuery === null ? null : outcomeKey(activeQuery, lang);
  const outcome = key ? outcomes[key] : undefined;
  const needsFetch = key !== null && outcome === undefined;

  useEffect(() => {
    if (!needsFetch || activeQuery === null || key === null) return undefined;
    const controller = new AbortController();
    const settle = (next: Outcome) => {
      if (!controller.signal.aborted) setOutcomes((prev) => ({ ...prev, [key]: next }));
    };

    triageCivicNeed(activeQuery, CATALOG, lang, { signal: controller.signal })
      .then((result) => settle({ status: "ready", result: result as TriageResult }))
      .catch((error: unknown) => {
        if ((error as Error).name === "AbortError") return;
        settle({
          status: "error",
          message: error instanceof GeminiError ? error.message : "Something went wrong.",
          disabled: isGeminiDisabled(error),
        });
      });
    return () => controller.abort();
  }, [needsFetch, activeQuery, key, lang]);

  const triage = useCallback(
    (query: string) => {
      const trimmed = query.trim();
      if (!trimmed) return;
      // Asking again after a failure is a retry: forget the cached error.
      const retryKey = outcomeKey(trimmed, lang);
      setOutcomes((prev) => {
        if (prev[retryKey]?.status !== "error") return prev;
        const next = { ...prev };
        delete next[retryKey];
        return next;
      });
      setRequestedQuery(trimmed);
    },
    [lang],
  );

  const clear = useCallback(() => setRequestedQuery(null), []);

  let state: TriageState;
  if (activeQuery === null) state = { status: "idle" };
  else if (!outcome) state = { status: "loading", query: activeQuery, lang };
  else if (outcome.status === "ready") state = { status: "ready", query: activeQuery, lang, result: outcome.result };
  else state = { status: "error", query: activeQuery, lang, message: outcome.message, disabled: outcome.disabled };

  return { state, triage, clear };
}
