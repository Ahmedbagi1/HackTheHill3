import type { Catalog } from "../translator";

/**
 * Inuktitut (ᐃᓄᒃᑎᑐᑦ), syllabics. DRAFT interface text only, pending review
 * by fluent speakers or a certified translator. Kept deliberately small: only
 * terms supplied in the project brief and common words we're confident in.
 * Everything else falls back to English and is marked "EN" on screen, which
 * is safer than guessing. scripts/i18n-report.json lists what's pending.
 * Placeholders such as {count} must be kept.
 */
const iu: Catalog = {
  // Navigation and actions (terms from the project brief)
  "All services": "ᐱᔨᑦᑎᕋᐅᑏᑦ ᑕᒪᕐᒥᒃ",
  "Federal (Canada)": "ᒐᕙᒪᑐᖃᒃᑯᑦ (ᑲᓇᑕ)",
  "Provincial / Territorial": "ᐊᕕᒃᑐᖅᓯᒪᔪᓂ",
  "Municipal (Ottawa)": "ᓄᓇᓕᖕᓂ (ᐋᑐᕚ)",
  "Disruptions & Alerts": "ᑐᐊᕕᕐᓇᖅᑐᑦ ᐊᒻᒪ ᖃᐅᔨᒃᑲᐃᔾᔪᑏᑦ",
  "New application": "ᓄᑖᖅ ᑐᒃᓯᕋᐅᑦ",
  "Search services or a task…": "ᕿᓂᕐᓗᒋᑦ ᒐᕙᒪᒃᑯᓐᓂ ᐱᔨᑦᑎᕋᐅᑏᑦ…",
  "Start application": "ᐱᒋᐊᕐᓗᒍ ᑐᒃᓯᕋᐅᑦ",
  "Audio summary": "ᑐᓴᐅᒪᔾᔪᑎᑦ ᓂᐱᒃᑯᑦ",
  "Step {current} of {total}": "ᐃᓚᖓ {current} ᑕᕝᕙᙵᑦ {total}",
  Back: "ᐅᑎᕐᓗᓂ",
  Next: "ᓯᕗᒧᐊᕐᓗᓂ",
  "Submit application": "ᑐᓂᓗᒍ",
  "{count} active application": "{count} ᐱᓕᕆᐊᖑᔪᖅ ᑐᒃᓯᕋᐅᑦ",
  "{count} active applications": "{count} ᐱᓕᕆᐊᖑᔪᑦ ᑐᒃᓯᕋᐅᑏᑦ",
  "Next pickup: {day}": "ᑲᑎᖅᓱᐃᓂᖅ ᑭᖑᓪᓕᖅ: {day}",

  // Levels of government (short forms of the brief's terms)
  Federal: "ᒐᕙᒪᑐᖃᒃᑯᑦ",
  Provincial: "ᐊᕕᒃᑐᖅᓯᒪᔪᓂ",
  Municipal: "ᓄᓇᓕᖕᓂ",

  // Common words
  Services: "ᐱᔨᑦᑎᕋᐅᑏᑦ",
  "Available services": "ᐱᔨᑦᑎᕋᐅᑏᑦ ᐱᑕᖃᖅᑐᑦ",
  Language: "ᐅᖃᐅᓯᖅ",
  Yes: "ᐄ",
  No: "ᐋᒃᑲ",
  Close: "ᒪᑐᓗᒍ",
  Open: "ᒪᑐᐃᓗᒍ",
  Done: "ᐃᓱᓕᑦᑐᖅ",
  Guest: "ᐳᓪᓚᖅᑐᖅ",
  Today: "ᐅᓪᓗᒥ",
  Tomorrow: "ᖃᐅᑉᐸᑦ",
  "Good morning": "ᐅᓪᓛᒃᑯᑦ",
  "Good afternoon": "ᐅᓐᓄᓴᒃᑯᑦ",
  "Good evening": "ᐅᓐᓄᒃᑯᑦ",
};

export default iu;
