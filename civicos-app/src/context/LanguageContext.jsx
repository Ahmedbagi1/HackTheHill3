/**
 * Compatibility API for components using inline EN/FR translations.
 * Shares the app's language state with the catalog-based translation API:
 *
 *   const { currentLang, setLanguage, t } = useLanguage();
 *   t("tier.all")                      // dictionary key, English fallback
 *   t("Save", "Enregistrer")           // inline EN/FR pair
 */

import { useMemo } from "react";
import { useI18n } from "../i18n/i18nContext";
import { LANGUAGE_BY_CODE, tr } from "../i18n/i18n";
import { getFormatters } from "../i18n/format";

export { LanguageProvider } from "../i18n/LanguageContext";
export { LANGUAGE_OPTIONS } from "../i18n/i18n";

// This compatibility module intentionally exports both the provider and its hook.
// eslint-disable-next-line react/only-export-components
export function useLanguage() {
  const { locale: lang, setLocale: setLang, info } = useI18n();
  return useMemo(
    () => ({
      currentLang: lang,
      language: LANGUAGE_BY_CODE[lang],
      setLanguage: setLang,
      t: tr(lang),
      fmt: getFormatters(lang),
      locale: info.intl,
    }),
    [lang, setLang, info.intl],
  );
}
