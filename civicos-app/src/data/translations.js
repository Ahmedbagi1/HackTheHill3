/**
 * Keyed UI dictionary for English, French, Inuktitut and Anishinaabemowin.
 *
 * `en` is the source of truth and must define every key. Other languages may
 * be partial: missing keys fall back to English (see src/i18n/i18n.ts), so a
 * label is never blank or `undefined`.
 *
 * Inuktitut and Anishinaabemowin coverage is intentionally limited to strings
 * provided by the project team. Don't machine-translate new entries — leave
 * them out and let them fall back to English until a fluent speaker reviews
 * them.
 */

export const TRANSLATIONS = {
  en: {
    "tier.all": "All Services",
    "tier.municipal": "Municipal (Ottawa)",
    "tier.provincial": "Provincial / Territorial",
    "tier.federal": "Federal (Canada)",
    "search.placeholder": "Search services...",
    "action.startApplication": "Start Application",
    "audio.summary": "Audio Summary",
    "alerts.title": "Civic Alerts & Disruptions",
    "filter.region": "Filter by Region",
    "wizard.back": "Back",
    "wizard.next": "Next",
    "wizard.submit": "Submit application",
    "wizard.cancel": "Cancel",
    "wizard.done": "Done",
    "language.label": "Language",
  },

  fr: {
    "tier.all": "Tous les services",
    "tier.municipal": "Municipal (Ottawa)",
    "tier.provincial": "Provincial / Territorial",
    "tier.federal": "Fédéral (Canada)",
    "search.placeholder": "Rechercher des services...",
    "action.startApplication": "Commencer la demande",
    "audio.summary": "Résumé audio",
    "alerts.title": "Alertes civiques et perturbations",
    "filter.region": "Filtrer par région",
    "wizard.back": "Retour",
    "wizard.next": "Suivant",
    "wizard.submit": "Soumettre la demande",
    "wizard.cancel": "Annuler",
    "wizard.done": "Terminé",
    "language.label": "Langue",
  },

  iu: {
    "tier.all": "ᐱᔨᑦᑎᕋᐅᑏᑦ ᑕᒪᕐᒥᒃ",
    "tier.municipal": "ᓄᓇᓕᖕᓂ (ᐋᑐᕚ)",
    "tier.provincial": "ᐊᕕᒃᑐᖅᓯᒪᔪᓂ",
    "tier.federal": "ᒐᕙᒪᑐᖃᒃᑯᑦ (ᑲᓇᑕ)",
    "search.placeholder": "ᕿᓂᕐᓗᒋᑦ ᒐᕙᒪᒃᑯᓐᓂ ᐱᔨᑦᑎᕋᐅᑏᑦ...",
    "action.startApplication": "ᐱᒋᐊᕐᓗᒍ ᑐᒃᓯᕋᐅᑦ",
    "audio.summary": "ᑐᓴᐅᒪᔾᔪᑎᑦ ᓂᐱᒃᑯᑦ",
    "alerts.title": "ᑐᐊᕕᕐᓇᖅᑐᑦ ᐊᒻᒪ ᖃᐅᔨᒃᑲᐃᔾᔪᑏᑦ",
  },

  oj: {
    "tier.all": "Gakina Anokiiwinan",
    "tier.municipal": "Oodena (Ottawa)",
    "tier.provincial": "Akiing Gaa-bi-izhiwebak",
    "tier.federal": "Gichi-ogimaawiwin (Canada)",
    "search.placeholder": "Nandawaabandan...",
    "action.startApplication": "Maajitaawin",
    "audio.summary": "Noondamowin",
    "alerts.title": "Wiindamaagewinan",
  },
};

/** @typedef {keyof typeof TRANSLATIONS.en} TranslationKey */
