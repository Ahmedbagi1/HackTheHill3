import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { getFormatters } from "./format";
import { detectLang, INTL_LOCALES, LANG_STORAGE_KEY, LOCALES, tr, type Lang } from "./i18n";
import { I18nContext, type I18nValue } from "./I18nContext";

// Inuktitut and Anishinaabemowin fall back to English until reviewed translations exist.
const TITLES: Partial<Record<Lang, string>> & { en: string } = {
  en: "CivicOS: Civic Services Dashboard",
  fr: "CivicOS : Tableau de bord des services civiques",
};

const DESCRIPTIONS: Partial<Record<Lang, string>> & { en: string } = {
  en: "Federal, Ontario and City of Ottawa services, request tracking and live civic updates in one place.",
  fr: "Les services fédéraux, de l'Ontario et de la Ville d'Ottawa, le suivi des demandes et l'actualité locale en un seul endroit.",
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch {
      // Storage unavailable: the choice lasts for this visit.
    }
    // A shared ?lang= link must not override the choice on reload.
    const url = new URL(window.location.href);
    if (url.searchParams.has("lang")) {
      url.searchParams.set("lang", next);
      window.history.replaceState(window.history.state, "", url);
    }
  }, []);

  // Keep the document's language, title and description in step for assistive tech and tabs.
  useEffect(() => {
    document.documentElement.lang = LOCALES[lang];
    document.title = TITLES[lang] ?? TITLES.en;
    document.querySelector('meta[name="description"]')?.setAttribute("content", DESCRIPTIONS[lang] ?? DESCRIPTIONS.en);
  }, [lang]);

  const value = useMemo<I18nValue>(
    () => ({ lang, locale: INTL_LOCALES[lang], setLang, t: tr(lang), fmt: getFormatters(lang) }),
    [lang, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
