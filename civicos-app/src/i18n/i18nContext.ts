import { createContext, useContext } from "react";
import type { DateStyle } from "./dates";
import type { Locale, LocaleInfo } from "./locales";
import type { Params } from "./translator";

export interface I18nContextValue {
  locale: Locale;
  info: LocaleInfo;
  setLocale: (locale: Locale) => void;
  t: (text: string, params?: Params) => string;
  tp: (one: string, other: string, count: number, params?: Params) => string;
  /** Translate if known, else pass through silently (user-entered values). */
  tm: (text: string) => string;
  /** Whether `text` has a translation in the active locale. */
  has: (text: string) => boolean;
  formatDate: (value: Date | string | number, style?: DateStyle) => string;
  formatWhen: (iso: string) => string;
  relativeTime: (iso: string | undefined) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatMoney: (value: number, cents?: boolean) => string;
}

export const I18nContext = createContext<I18nContextValue | null>(null);

export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside <LanguageProvider>");
  return value;
}
