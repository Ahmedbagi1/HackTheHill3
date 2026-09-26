/**
 * Cross-tier natural-language search.
 *
 * 1. A query is matched to a life event (lifeEvents.js) using trigger phrases
 *    and keywords, e.g. "I lost my wallet" -> lost-wallet journey.
 * 2. Services are scored by weighted token overlap with their title,
 *    sub-services, keywords, agency and summaries (with synonyms + light stemming).
 * 3. Services in the matched journey are always included and ranked first,
 *    in checklist order, across Federal, Provincial and Municipal tiers.
 */

const STOPWORDS = new Set(
  "a an and are as at be but by can do does for from get go going have how i im in into is it its me my need of on or our so the their them to up want was we what when where which who will with you your help please".split(" "),
);

const SYNONYMS = {
  licence: ["license"],
  license: ["licence"],
  car: ["vehicle"],
  vehicle: ["car"],
  kid: ["child", "children"],
  child: ["children", "kid"],
  baby: ["newborn", "child"],
  trash: ["garbage", "waste"],
  garbage: ["trash", "waste"],
  bin: ["garbage", "recycling"],
  dentist: ["dental"],
  teeth: ["dental"],
  bus: ["transit"],
  transit: ["bus"],
  pension: ["cpp", "oas"],
  job: ["employment", "work"],
  unemployed: ["employment", "ei"],
  tax: ["taxes", "cra"],
  taxes: ["tax", "cra"],
  apartment: ["tenant", "rent"],
  rent: ["tenant", "landlord"],
  company: ["business"],
  business: ["company"],
  school: ["student", "tuition"],
  doctor: ["ohip", "health"],
  health: ["ohip"],
  vote: ["voter", "election"],
  dog: ["pet"],
  cat: ["pet"],
};

export const normalizeText = (value) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9$\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const stem = (word) => {
  if (word.length <= 4) return word;
  for (const suffix of ["ing", "ed", "es", "s"]) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 3) return word.slice(0, -suffix.length);
  }
  return word;
};

const splitWords = (text) => normalizeText(text).split(/[\s-]+/).filter(Boolean);

export const tokenize = (query) => [
  ...new Set(splitWords(query).filter((w) => !STOPWORDS.has(w)).map(stem)),
];

const expand = (token) => [token, ...(SYNONYMS[token] ?? []).map(stem)];

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const containsPhrase = (haystack, phrase) =>
  new RegExp(`(^|\\s)${escapeRegExp(normalizeText(phrase))}(\\s|$)`).test(haystack);

/* ------------------------------------------------------------------------ */
/* Service index                                                            */
/* ------------------------------------------------------------------------ */

const FIELD_WEIGHTS = [
  ["title", 6],
  ["subServices", 4],
  ["keywords", 4],
  ["agency", 2],
  ["summary", 1.5],
  ["plainLanguage", 0.5],
];

const indexCache = new WeakMap();

const indexService = (service) => {
  if (indexCache.has(service)) return indexCache.get(service);
  const index = FIELD_WEIGHTS.map(([field, weight]) => {
    const raw = [].concat(service[field] ?? []).join(" ");
    return { weight, words: new Set(splitWords(raw).map(stem)), phrases: [].concat(service[field] ?? []).map(normalizeText) };
  });
  indexCache.set(service, index);
  return index;
};

const serviceHasToken = (service, token) => {
  const candidates = expand(token);
  return indexService(service).some((f) => candidates.some((c) => f.words.has(c)));
};

/**
 * Inverse document frequency per token: distinctive words ("pothole") count
 * for more than common ones ("street", "lost").
 */
const tokenWeights = (tokens, services) =>
  new Map(
    tokens.map((token) => {
      const df = services.filter((service) => serviceHasToken(service, token)).length;
      return [token, df ? Math.log(1 + services.length / df) : 0];
    }),
  );

/** @returns {{ score: number, coverage: number }} */
export const scoreService = (service, tokens, normalizedQuery, idf = new Map()) => {
  if (!tokens.length) return { score: 0, coverage: 0 };
  const index = indexService(service);

  let score = 0;
  let matched = 0;
  for (const token of tokens) {
    const candidates = expand(token);
    const best = Math.max(0, ...index.filter((f) => candidates.some((c) => f.words.has(c))).map((f) => f.weight));
    if (best > 0) matched += 1;
    score += best * (idf.get(token) ?? 1);
  }

  // Whole-phrase bonus, e.g. "lost wallet" appearing verbatim in keywords.
  if (normalizedQuery.includes(" ") && index.some((f) => f.phrases.some((p) => p.includes(normalizedQuery)))) {
    score += 8;
  }

  const coverage = matched / tokens.length;
  return { score: coverage >= 0.5 ? score * coverage : 0, coverage };
};

/* ------------------------------------------------------------------------ */
/* Life events                                                              */
/* ------------------------------------------------------------------------ */

export const matchLifeEvent = (query, lifeEvents) => {
  const normalized = normalizeText(query);
  if (!normalized) return null;
  const tokens = tokenize(query);

  let best = null;
  for (const event of lifeEvents) {
    let score = 0;
    if (event.triggers.some((trigger) => containsPhrase(normalized, trigger))) score += 10;
    const keywordStems = new Set(event.keywords.map((k) => stem(normalizeText(k))));
    score += tokens.filter((t) => keywordStems.has(t)).length * 2;
    if (score >= 4 && (!best || score > best.score)) best = { event, score };
  }
  return best?.event ?? null;
};

/* ------------------------------------------------------------------------ */
/* Public API                                                               */
/* ------------------------------------------------------------------------ */

/**
 * @returns {{ lifeEvent: object|null, results: object[], stepByServiceId: Map<string, number> }}
 */
export function searchCatalog(query, services, lifeEvents) {
  const tokens = tokenize(query);
  if (!tokens.length) {
    return { lifeEvent: null, results: services, stepByServiceId: new Map() };
  }

  const normalized = normalizeText(query);
  const lifeEvent = matchLifeEvent(query, lifeEvents);
  const stepByServiceId = new Map();
  lifeEvent?.steps.forEach((step, index) => {
    if (!stepByServiceId.has(step.serviceId)) stepByServiceId.set(step.serviceId, index + 1);
  });

  const idf = tokenWeights(tokens, services);
  const results = services
    .map((service) => {
      const step = stepByServiceId.get(service.id);
      // Journey services always appear, ranked first in checklist order.
      if (step) return { service, score: 1000 - step };
      const { score, coverage } = scoreService(service, tokens, normalized, idf);
      // With a journey matched, only add other services that match every term.
      return { service, score: lifeEvent && coverage < 1 ? 0 : score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ service }) => service);

  return { lifeEvent, results, stepByServiceId };
}
