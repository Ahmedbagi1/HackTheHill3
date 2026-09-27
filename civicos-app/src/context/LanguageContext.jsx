/**
 * Public language API. The state lives in src/i18n/LanguageProvider.tsx; this
 * module exposes it under the names components use:
 *
 *   const { currentLang, setLanguage, t } = useLanguage();
 *   t("tier.all")                      // dictionary key, English fallback
 *   t("Save", "Enregistrer")           // inline EN/FR pair
 */

import { useMemo } from "react";
import { useI18n } from "../i18n/I18nContext";
import { LANGUAGE_BY_CODE } from "../i18n/i18n";

export { LanguageProvider } from "../i18n/LanguageProvider";
export { LANGUAGE_OPTIONS } from "../i18n/i18n";

export function useLanguage() {
  const { lang, setLang, t, fmt, locale } = useI18n();
  return useMemo(
    () => ({
      currentLang: lang,
      language: LANGUAGE_BY_CODE[lang],
      setLanguage: setLang,
      t,
      fmt,
      locale,
    }),
    [lang, setLang, t, fmt, locale],
  );
}
