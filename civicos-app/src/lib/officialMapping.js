/**
 * Resolves a service's `official` metadata (see data/servicesData.js) against
 * an applicant's answers: which official forms apply, how they can be
 * submitted, and which steps the law requires to be done in person.
 */

export const CHANNEL_LABELS = {
  online: "Online",
  mail: "By mail",
  "in-person": "In person",
  phone: "By phone",
  automatic: "Automatic after you file your taxes",
};

const applies = (condition, formData) => !condition || condition(formData);

/** @returns {{ id: string, title: string }[]} */
export const officialFormsFor = (service, formData) =>
  (service.official?.forms ?? []).filter((form) => applies(form.when, formData)).map(({ id, title }) => ({ id, title }));

/** @returns {{ id: string, step: string, reason: string, where: string, mode: "in-person" | "in-person-or-mail" }[]} */
export const inPersonStepsFor = (service, formData) =>
  (service.official?.inPerson ?? [])
    .filter((step) => applies(step.applies, formData))
    .map(({ id, step, reason, where, mode = "in-person" }) => ({ id, step, reason, where, mode }));

export const channelsFor = (service) => (service.official?.channels ?? []).map((id) => ({ id, label: CHANNEL_LABELS[id] ?? id }));
