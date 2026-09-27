import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { loadCatalog } from "./catalogs";
import { formatDate, formatWhen, relativeTime } from "./dates";
import { I18nContext, type I18nContextValue } from "./i18nContext";
import { isLocale, LOCALE_INFO, type Locale } from "./locales";
import { recordMissing } from "./missing";
import { createTranslator, type Catalog } from "./translator";

const STORAGE_KEY = "civicos:locale";

function initialLocale(): Locale {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (isLocale(saved)) return saved;
  } catch {
    // Storage blocked; fall through to the browser language.
  }
  return navigator.language?.toLowerCase().startsWith("fr") ? "fr" : "en";
}

/**
 * Supplies the active language to the whole app. Switching languages loads
 * the catalog, then swaps it in without a page reload; the previous language
 * stays on screen until the new one is ready.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [requested, setRequested] = useState<Locale>(initialLocale);
  const [active, setActive] = useState<{ locale: Locale; catalog: Catalog } | null>(() =>
    requested === "en" ? { locale: "en", catalog: {} } : null,
  );

  useEffect(() => {
    let cancelled = false;
    loadCatalog(requested)
      .then((catalog) => {
        if (!cancelled) setActive({ locale: requested, catalog });
      })
      .catch(() => {
        if (!cancelled) setActive({ locale: "en", catalog: {} });
      });
    return () => {
      cancelled = true;
    };
  }, [requested]);

  const locale = active?.locale ?? "en";

  useEffect(() => {
    document.documentElement.lang = LOCALE_INFO[locale].htmlLang;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setRequested(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Preference just won't persist.
    }
  }, []);

  const value = useMemo<I18nContextValue>(() => {
    const info = LOCALE_INFO[locale];
    const translator = createTranslator(locale, active?.catalog ?? {}, info.intl, (text) => recordMissing(locale, text));
    const { t, tp, tm, has, formatNumber } = translator;
    return {
      locale,
      info,
      setLocale,
      t,
      tp,
      tm,
      has,
      formatNumber,
      formatMoney: (amount, cents = false) =>
        formatNumber(amount, { style: "currency", currency: "CAD", maximumFractionDigits: cents ? 2 : 0, minimumFractionDigits: cents ? 2 : 0 }),
      formatDate: (date, style) => formatDate(locale, date, style),
      formatWhen: (iso) => formatWhen(locale, t, iso),
      relativeTime: (iso) => relativeTime(locale, iso, t),
    };
  }, [locale, active, setLocale]);

  // First paint waits for a saved non-English catalog so the page doesn't flash English.
  if (!active) return null;
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
