export type Locale = "en" | "fr" | "iu" | "oj";

export interface LocaleInfo {
  code: Locale;
  /** Label in the language itself, shown in the picker. */
  nativeName: string;
  /** English name for screen readers and tooltips. */
  englishName: string;
  /** Value for <html lang> and lang attributes (BCP 47). */
  htmlLang: string;
  /** Locale passed to Intl for numbers; iu/oj fall back to Canadian English formatting. */
  intl: string;
  /**
   * `complete`: every string is translated.
   * `draft`: interface text only, awaiting review by fluent speakers; longer
   * content falls back to English and is marked.
   */
  status: "complete" | "draft";
}

export const LOCALES: LocaleInfo[] = [
  { code: "en", nativeName: "English", englishName: "English", htmlLang: "en-CA", intl: "en-CA", status: "complete" },
  { code: "fr", nativeName: "Français", englishName: "French", htmlLang: "fr-CA", intl: "fr-CA", status: "complete" },
  { code: "iu", nativeName: "ᐃᓄᒃᑎᑐᑦ (Inuktitut)", englishName: "Inuktitut", htmlLang: "iu", intl: "en-CA", status: "draft" },
  { code: "oj", nativeName: "Anishinaabemowin", englishName: "Ojibwe (Anishinaabemowin)", htmlLang: "oj", intl: "en-CA", status: "draft" },
];

export const LOCALE_INFO = Object.fromEntries(LOCALES.map((l) => [l.code, l])) as Record<Locale, LocaleInfo>;

export const isLocale = (value: unknown): value is Locale => typeof value === "string" && value in LOCALE_INFO;
