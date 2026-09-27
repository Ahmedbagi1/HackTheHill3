import type { SavedApplication, ApplicationStatus } from '../services/applicationRepository';
import type { UserRequest, ServiceCategoryId } from '../types/dashboard';

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  submitted: 'Submitted', under_review: 'Under review', needs_information: 'Needs information',
  completed: 'Completed', rejected: 'Rejected', withdrawn: 'Withdrawn',
};

/** Server state only: elapsed days never advance a persisted application. */
export function savedApplicationView(row: SavedApplication): UserRequest {
  return {
    id: row.id, referenceId: row.reference_id, serviceId: row.service_id,
    module: 'service', title: row.title, category: row.category as ServiceCategoryId,
    submittedAt: row.submitted_at, summary: row.summary, simulated: true,
    persistence: 'supabase', status: row.status, revision: row.revision,
    currentStage: 0,
    stages: [{
      key: row.status, label: APPLICATION_STATUS_LABELS[row.status], typicalDays: 0,
      state: row.status === 'needs_information' ? 'blocked'
        : ['completed', 'rejected', 'withdrawn'].includes(row.status) ? 'done' : 'current',
      date: row.updated_at,
    }],
    actionRequired: row.status === 'needs_information' ? {
      kind: 'respond', label: 'Provide test information', detail: 'The CivicOS prototype review requests additional information.',
    } : undefined,
  };
}
