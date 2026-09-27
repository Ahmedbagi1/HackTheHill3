import type { Locale } from "./locales";

/**
 * Strings rendered without a translation, per locale. The i18n audit and the
 * end-to-end suite read this (window.__civicosI18nMissing in development) to
 * prove French has no gaps.
 */
const missing = new Map<Locale, Set<string>>();

export function recordMissing(locale: Locale, text: string): void {
  let set = missing.get(locale);
  if (!set) {
    set = new Set();
    missing.set(locale, set);
  }
  set.add(text);
}

export const missingFor = (locale: Locale): string[] => [...(missing.get(locale) ?? [])];

if (import.meta.env?.DEV && typeof window !== "undefined") {
  (window as unknown as { __civicosI18nMissing: (locale: Locale) => string[] }).__civicosI18nMissing = missingFor;
}
