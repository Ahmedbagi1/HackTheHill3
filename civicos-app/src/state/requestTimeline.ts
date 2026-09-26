/**
 * Request status timelines.
 *
 * CivicOS has no government back-end, so stage progress is simulated from each
 * program's typical stage durations and the submission date. Progress stops at
 * a stage that needs the citizen's action (e.g. missing documents) and at
 * open-ended stages (e.g. a housing waiting list with no reliable ETA).
 */

import type { RequestAction, RequestModuleId, RequestStage, UserRequest } from "../types/dashboard";

export interface StageTemplate {
  key: string;
  label: string;
  typicalDays: number;
  /** Stage has no reliable duration; progress waits here. */
  openEnded?: boolean;
}

export const STAGE_TEMPLATES: Record<RequestModuleId, StageTemplate[]> = {
  housing: [
    { key: "submitted", label: "Submitted", typicalDays: 0 },
    { key: "review", label: "Eligibility review", typicalDays: 14 },
    { key: "waitlist", label: "On waiting list", typicalDays: 0, openEnded: true },
    { key: "offer", label: "Unit offered", typicalDays: 0 },
    { key: "housed", label: "Housed", typicalDays: 0 },
  ],
  doctor: [
    { key: "registered", label: "Registered", typicalDays: 0 },
    { key: "verification", label: "Verification", typicalDays: 2 },
    { key: "waiting", label: "Waiting for a spot", typicalDays: 28 },
    { key: "matched", label: "Matched", typicalDays: 0 },
  ],
  autism: [
    { key: "registered", label: "Intake submitted", typicalDays: 0 },
    { key: "coordination", label: "Care coordinator contact", typicalDays: 21 },
    { key: "needs", label: "Determination of needs", typicalDays: 30 },
    { key: "funding", label: "Funding available", typicalDays: 0 },
  ],
  service: [
    { key: "submitted", label: "Submitted", typicalDays: 0 },
    { key: "screening", label: "Screening", typicalDays: 3 },
    { key: "decision", label: "Decision", typicalDays: 7 },
    { key: "complete", label: "Complete", typicalDays: 0 },
  ],
};

/** What's persisted; stages and actions are derived at read time. */
export interface StoredRequest
  extends Pick<
    UserRequest,
    "id" | "referenceId" | "serviceId" | "module" | "title" | "category" | "submittedAt" | "summary" | "demo" | "waitlistPosition"
  > {
  /** Per-request overrides for typical stage durations (e.g. clinic wait). */
  stageDays?: Record<string, number>;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const iso = (ms: number) => new Date(ms).toISOString();

export function computeTimeline(
  template: StageTemplate[],
  submittedAt: string,
  options: { now?: number; holdAt?: string | null; stageDays?: Record<string, number> } = {},
): { stages: RequestStage[]; currentStage: number; estimatedCompletion?: string } {
  const now = options.now ?? Date.now();
  let cursor = Date.parse(submittedAt);
  let current = -1;
  let blocked = false;
  let openEnded = false;

  const stages: RequestStage[] = template.map((stage, index) => {
    const days = options.stageDays?.[stage.key] ?? stage.typicalDays;
    const base = { key: stage.key, label: stage.label, typicalDays: days };

    if (current !== -1) {
      // Stages after the current one are upcoming; project dates unless progress is paused.
      if (!openEnded && !blocked) cursor += days * DAY_MS;
      return { ...base, state: "upcoming", date: openEnded || blocked ? undefined : iso(cursor) };
    }

    const end = cursor + days * DAY_MS;
    const held = options.holdAt === stage.key;
    const isLast = index === template.length - 1;

    if (index === 0) {
      return { ...base, state: "done", date: iso(cursor) };
    }
    if (held) {
      current = index;
      blocked = true;
      return { ...base, state: "blocked", date: iso(end) };
    }
    if (stage.openEnded) {
      current = index;
      openEnded = true;
      return { ...base, state: "current" };
    }
    if (now >= end && !isLast) {
      cursor = end;
      return { ...base, state: "done", date: iso(end) };
    }
    if (isLast && now >= end) {
      current = index;
      return { ...base, state: "done", date: iso(end) };
    }
    current = index;
    cursor = end;
    return { ...base, state: "current", date: iso(end) };
  });

  const currentStage = current === -1 ? stages.length - 1 : current;
  const last = stages[stages.length - 1];
  const estimatedCompletion = openEnded || blocked ? undefined : last.date;
  return { stages, currentStage, estimatedCompletion };
}

export function materializeRequest(
  stored: StoredRequest,
  action: RequestAction | undefined,
  holdAt: string | null,
  now = Date.now(),
): UserRequest {
  const { stages, currentStage, estimatedCompletion } = computeTimeline(STAGE_TEMPLATES[stored.module], stored.submittedAt, {
    now,
    holdAt: action ? holdAt : null,
    stageDays: stored.stageDays,
  });
  return {
    ...stored,
    stages,
    currentStage,
    estimatedCompletion,
    actionRequired: action,
    simulated: true,
  };
}
