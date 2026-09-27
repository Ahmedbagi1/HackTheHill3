/**
 * Multilingual support: Canada's official languages (English, French) plus
 * Inuktitut and Anishinaabemowin.
 *
 * Two ways to translate, both through `t`:
 *
 *   t("Save", "Enregistrer")   // inline EN/FR pair, written where it's used
 *   t("tier.all")              // key from src/data/translations.js
 *
 * Inline pairs keep both official languages side by side so a missing French
 * string can't slip through. Keys are for labels that also have Inuktitut or
 * Anishinaabemowin translations. Inline pairs also pick those up: when the
 * English text matches a dictionary entry, the dictionary wins.
 *
 * Fallback: Inuktitut and Anishinaabemowin coverage is partial, so any string
 * without a translation renders in English — never blank or `undefined`.
 *
 * React code gets `t` from useI18n() / useLanguage(); code outside React
 * receives `lang` and calls tr(lang). Ids, option values and stored data stay
 * language-neutral, so switching language re-renders everything in place.
 */

import { TRANSLATIONS } from "../data/translations";

export type Lang = "en" | "fr" | "iu" | "oj";

export type TranslationKey = keyof typeof TRANSLATIONS.en;

export const LANGS: readonly Lang[] = ["en", "fr", "iu", "oj"];

/** BCP 47 tags for <html lang>, so screen readers and font fallback pick the right language and script. */
export const LOCALES: Record<Lang, string> = { en: "en-CA", fr: "fr-CA", iu: "iu-Cans-CA", oj: "oj-CA" };

/**
 * Locales for Intl number/date formatting. Browsers ship little or no CLDR
 * data for Inuktitut and none for Anishinaabemowin; an unsupported tag falls
 * back to the browser's default locale, which could be anything. Canadian
 * English is the explicit, predictable fallback.
 */
export const INTL_LOCALES: Record<Lang, string> = { en: "en-CA", fr: "fr-CA", iu: "en-CA", oj: "en-CA" };

export interface LanguageOption {
  code: Lang;
  /** Endonym shown in the selector. */
  label: string;
  /** English name, for screen readers and tooltips. */
  englishName: string;
}

export const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
  { code: "en", label: "English", englishName: "English" },
  { code: "fr", label: "Français", englishName: "French" },
  { code: "iu", label: "ᐃᓄᒃᑎᑐᑦ", englishName: "Inuktitut" },
  { code: "oj", label: "Anishinaabemowin", englishName: "Ojibwe" },
];

export const LANGUAGE_BY_CODE = Object.fromEntries(LANGUAGE_OPTIONS.map((option) => [option.code, option])) as Record<
  Lang,
  LanguageOption
>;

export interface Translate {
  (key: TranslationKey): string;
  (en: string, fr: string): string;
  <T>(en: T, fr: T): T;
}

const NBSP = " ";

/**
 * Canadian French typography: no-break spaces inside numbers ("5 000"), before
 * "$", "%" and ":", and inside « guillemets », so none of them wrap alone.
 */
export const frTypography = (value: string) =>
  value
    .replace(/(\d) (?=\d{3}(?!\d))/g, `$1${NBSP}`)
    .replace(/(\d) (?=[$%])/g, `$1${NBSP}`)
    .replace(/ (?=[:»])/g, NBSP)
    .replace(/« /g, `«${NBSP}`);

const typeset = <T>(value: T): T =>
  (typeof value === "string"
    ? frTypography(value)
    : Array.isArray(value)
      ? value.map((item) => (typeof item === "string" ? frTypography(item) : item))
      : value) as T;

type Dictionary = Partial<Record<TranslationKey, string>>;

const DICTIONARIES = TRANSLATIONS as Record<Lang, Dictionary>;
const ENGLISH = TRANSLATIONS.en as Record<TranslationKey, string>;

/** Reverse index so inline EN/FR pairs can find Inuktitut/Anishinaabemowin entries. */
const KEY_BY_ENGLISH = new Map<string, TranslationKey>(
  (Object.entries(ENGLISH) as [TranslationKey, string][]).map(([key, text]) => [text, key]),
);

/** Dictionary lookup with English fallback; an unknown key is returned as-is rather than `undefined`. */
const lookup = (lang: Lang, key: string): string => {
  const value = DICTIONARIES[lang][key as TranslationKey] ?? ENGLISH[key as TranslationKey] ?? key;
  return lang === "fr" ? frTypography(value) : value;
};

const createTranslate = (lang: Lang): Translate =>
  // One implementation serves every overload of Translate, so its return is untyped here.
  (...args: unknown[]): any => {
    if (args.length === 1) return lookup(lang, String(args[0]));
    const [en, fr] = args;
    if (lang === "en") return en;
    if (lang === "fr") return typeset(fr);
    // Inuktitut / Anishinaabemowin: dictionary entry for this English text, otherwise English.
    const key = typeof en === "string" ? KEY_BY_ENGLISH.get(en) : undefined;
    return (key && DICTIONARIES[lang][key]) || en;
  };

// One stable function per language so memoized consumers only re-render on a real language change.
const TRANSLATORS = Object.fromEntries(LANGS.map((lang) => [lang, createTranslate(lang)])) as Record<Lang, Translate>;

export const tr = (lang: Lang): Translate => TRANSLATORS[lang] ?? TRANSLATORS.en;

/** Builds localized data once per language and reuses it. */
export function byLang<T>(build: (t: Translate, lang: Lang) => T): (lang: Lang) => T {
  const cache = new Map<Lang, T>();
  return (lang) => {
    if (!cache.has(lang)) cache.set(lang, build(tr(lang), lang));
    return cache.get(lang) as T;
  };
}

export const isLang = (value: unknown): value is Lang => LANGS.includes(value as Lang);

export const LANG_STORAGE_KEY = "civicos:lang";

/** ?lang= in the URL, then the saved choice, then the browser's preferred languages. */
export function detectLang(): Lang {
  try {
    const param = new URLSearchParams(window.location.search).get("lang");
    if (isLang(param)) return param;
    const saved = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (isLang(saved)) return saved;
  } catch {
    // Storage or URL unavailable: fall through to the browser preference.
  }
  const preferred = typeof navigator === "undefined" ? [] : (navigator.languages ?? [navigator.language]);
  for (const tag of preferred) {
    const base = tag.toLowerCase().split("-")[0];
    // "oji" and "ciw" are the ISO 639-3 codes browsers may report for Ojibwe.
    if (base === "oji" || base === "ciw") return "oj";
    if (isLang(base)) return base;
  }
  return "en";
}
