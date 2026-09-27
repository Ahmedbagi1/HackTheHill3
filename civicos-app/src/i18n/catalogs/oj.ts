import type { Catalog } from "../translator";

/**
 * Anishinaabemowin (Ojibwe), double-vowel orthography. DRAFT interface text
 * only, pending review by fluent speakers or a community language keeper.
 * Kept deliberately small: terms supplied in the project brief plus common
 * words we're confident in. Two brief terms were corrected: "good evening" is
 * Mino-onaagoshin and Friday is Naano-giizhigad. Everything else falls back to
 * English and is marked "EN" on screen. Placeholders such as {count} must be kept.
 */
const oj: Catalog = {
  // Navigation and actions (terms from the project brief)
  "All services": "Gakina Anokiiwinan",
  "Federal (Canada)": "Gichi-ogimaawiwin (Canada)",
  "Provincial / Territorial": "Akiing Gaa-bi-izhiwebak",
  "Municipal (Ottawa)": "Oodena (Ottawa)",
  "Disruptions & Alerts": "Wiindamaagewinan",
  "New application": "Oshki-anokiiwin",
  "Search services or a task…": "Nandawaabandan anokiiwinan…",
  "Start application": "Maajitaawin",
  "Audio summary": "Noondamowin",
  "Step {current} of {total}": "Dibaakonigan {current} akina {total}",
  Back: "Azhe-giiwe",
  Next: "Niigaan",
  "Submit application": "Wiindamaw",
  "{count} active application": "{count} Anokiiwin Maajitaa",
  "{count} active applications": "{count} Anokiiwinan Maajitaawag",
  "Next pickup: {day}": "Mawandoonigan: {day}",

  // Levels of government (short forms of the brief's terms)
  Federal: "Gichi-ogimaawiwin",
  Municipal: "Oodena",

  // Common words
  Services: "Anokiiwinan",
  Language: "Inwewin",
  Yes: "Eya'",
  No: "Gaawiin",
  Close: "Gibaakwaan",
  Done: "Giizhiitaa",
  Today: "Noongom",
  Tomorrow: "Waabang",
  "Good morning": "Mino-gigizheb",
  "Good afternoon": "Mino-giizhigad",
  "Good evening": "Mino-onaagoshin",
};

export default oj;
