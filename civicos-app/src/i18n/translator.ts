/**
 * Source-string translator.
 *
 * English text is the key (gettext style), so catalog data, component copy,
 * calculator output and records saved before a language switch all translate
 * at display time through the same lookup:
 *
 *   1. exact match:      "Next" -> "Suivant"
 *   2. pattern match:    "{label} is required." matches "Postal code is required."
 *                        and yields "Code postal est obligatoire." Captured
 *                        values are translated too, and money/numbers are
 *                        reformatted for the locale ("$90,000" -> "90 000 $").
 *   3. fallback:         the English text, recorded as missing.
 */
import type { Locale } from "./locales";

export type Catalog = Readonly<Record<string, string>>;
export type Params = Readonly<Record<string, string | number>>;

interface CompiledPattern {
  regex: RegExp;
  names: string[];
  target: string;
  /** Literal characters in the key; longer literals are more specific. */
  specificity: number;
}

const PLACEHOLDER = /\{(\w+)\}/g;
const HAS_LETTER = /\p{L}/u;
const MONEY = /^([−-]\s?)?\$(\d[\d,]*)(\.\d+)?$/;
const PLAIN_NUMBER = /^\d{1,3}(,\d{3})+(\.\d+)?$|^\d+\.\d+$/;
/** Space after sentence-ending punctuation, before the next sentence's first character. */
const SENTENCE_BREAK = /(?<=[.!?])\s+(?=[A-Z0-9$“"(])/;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Keys with little literal text (e.g. "{greeting}, {name}") would match almost
 * anything as patterns; they stay templates, used only by exact lookup.
 */
const MIN_PATTERN_LETTERS = 4;

function compile(key: string, target: string): CompiledPattern | null {
  if (key.replace(PLACEHOLDER, "").replace(/[^\p{L}]/gu, "").length < MIN_PATTERN_LETTERS) return null;
  const names: string[] = [];
  let source = "";
  let last = 0;
  for (const match of key.matchAll(PLACEHOLDER)) {
    source += escapeRegExp(key.slice(last, match.index));
    source += "(.+?)";
    names.push(match[1]);
    last = (match.index ?? 0) + match[0].length;
  }
  if (names.length === 0) return null;
  source += escapeRegExp(key.slice(last));
  return { regex: new RegExp(`^${source}$`, "s"), names, target, specificity: key.replace(PLACEHOLDER, "").length };
}

export interface Translator {
  locale: Locale;
  /** Translate `text`; `{name}` placeholders are filled from `params`. */
  t: (text: string, params?: Params) => string;
  /** Pick the singular or plural source string by the locale's plural rules, then translate. */
  tp: (one: string, other: string, count: number, params?: Params) => string;
  /** Translate when a translation exists; otherwise return the text unchanged without recording it (user-entered values). */
  tm: (text: string) => string;
  /** Whether `text` has a translation (or needs none) in this locale. */
  has: (text: string) => boolean;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
}

export function createTranslator(
  locale: Locale,
  catalog: Catalog,
  intlLocale: string,
  onMissing?: (text: string) => void,
): Translator {
  const exact = new Map(Object.entries(catalog));
  const patterns = Object.entries(catalog)
    .map(([key, target]) => compile(key, target))
    .filter((p): p is CompiledPattern => p !== null)
    .sort((a, b) => b.specificity - a.specificity);
  const cache = new Map<string, string | null>();
  const numberFormat = new Intl.NumberFormat(intlLocale);
  const plural = new Intl.PluralRules(intlLocale);
  const localizeNumbers = intlLocale !== "en-CA";

  const formatNumber = (value: number, options?: Intl.NumberFormatOptions) =>
    options ? new Intl.NumberFormat(intlLocale, options).format(value) : numberFormat.format(value);

  /** Money and grouped numbers written in en-CA style, reformatted for the locale. */
  const localizeNumeric = (value: string): string | null => {
    if (!localizeNumbers) return null;
    const money = MONEY.exec(value);
    if (money) {
      const amount = Number(`${money[2].replace(/,/g, "")}${money[3] ?? ""}`);
      const digits = money[3] ? money[3].length - 1 : 0;
      const formatted = formatNumber(amount, { style: "currency", currency: "CAD", minimumFractionDigits: digits, maximumFractionDigits: digits });
      return money[1] ? `− ${formatted}` : formatted;
    }
    if (PLAIN_NUMBER.test(value)) {
      const [whole, fraction] = value.replace(/,/g, "").split(".");
      return formatNumber(Number(`${whole}.${fraction ?? 0}`), { minimumFractionDigits: fraction?.length ?? 0, maximumFractionDigits: fraction?.length ?? 0 });
    }
    return null;
  };

  /**
   * Values captured by a pattern: translated whole, then as a comma-separated
   * list, then case-insensitively (labels are sometimes lowercased mid-sentence).
   */
  const lookupCapture = (value: string): string | null => {
    const whole = lookup(value);
    if (whole !== null) return whole;
    const loose = (part: string) => {
      const direct = lookup(part);
      if (direct !== null) return direct;
      const capitalized = part.charAt(0).toUpperCase() + part.slice(1);
      if (capitalized === part) return null;
      const translated = lookup(capitalized);
      return translated === null ? null : translated.charAt(0).toLowerCase() + translated.slice(1);
    };
    if (value.includes(", ")) {
      const parts = value.split(", ").map((part) => loose(part) ?? part);
      return parts.join(", ");
    }
    return loose(value);
  };

  const lookup = (text: string): string | null => {
    if (locale === "en") return text;
    const cached = cache.get(text);
    if (cached !== undefined) return cached;

    let result: string | null = exact.get(text) ?? null;
    if (result === null) {
      const trimmed = text.trim();
      if (trimmed !== text) {
        const inner = lookup(trimmed);
        result = inner === null ? null : text.replace(trimmed, inner);
      }
    }
    if (result === null) result = localizeNumeric(text);
    if (result === null && !HAS_LETTER.test(text)) result = text;
    if (result === null) {
      for (const pattern of patterns) {
        const match = pattern.regex.exec(text);
        if (!match) continue;
        const values = Object.fromEntries(pattern.names.map((name, i) => [name, match[i + 1]]));
        result = pattern.target.replace(PLACEHOLDER, (_, name: string) => {
          const captured = values[name];
          if (captured === undefined) return `{${name}}`;
          return lookupCapture(captured) ?? captured;
        });
        break;
      }
    }
    // Generated text sometimes joins several sentences; translate them one by one.
    if (result === null) {
      const sentences = text.split(SENTENCE_BREAK);
      if (sentences.length > 1) {
        const translated = sentences.map((sentence) => lookup(sentence));
        if (translated.every((s) => s !== null)) result = translated.join(" ");
      }
    }
    cache.set(text, result);
    return result;
  };

  const interpolate = (template: string, params?: Params) =>
    params
      ? template.replace(PLACEHOLDER, (whole, name: string) => {
          const value = params[name];
          if (value === undefined) return whole;
          return typeof value === "number" ? formatNumber(value) : value;
        })
      : template;

  const t = (text: string, params?: Params) => {
    if (!text) return text;
    const translated = lookup(text);
    if (translated === null) onMissing?.(text);
    return interpolate(translated ?? text, params);
  };

  return {
    locale,
    t,
    tp: (one, other, count, params) => t(plural.select(count) === "one" ? one : other, { count, ...params }),
    tm: (text) => (text ? (lookup(text) ?? text) : text),
    has: (text) => !text || lookup(text) !== null,
    formatNumber,
  };
}
