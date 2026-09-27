import { createContext, useContext } from "react";
import type { Formatters } from "./format";
import type { Lang, Translate } from "./i18n";

export interface I18nValue {
  lang: Lang;
  /** BCP 47 locale for Intl formatting, e.g. "fr-CA" (Inuktitut/Anishinaabemowin format as "en-CA"). */
  locale: string;
  setLang: (lang: Lang) => void;
  t: Translate;
  fmt: Formatters;
}

export const I18nContext = createContext<I18nValue | null>(null);

export function useI18n(): I18nValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside <LanguageProvider>");
  return context;
}
