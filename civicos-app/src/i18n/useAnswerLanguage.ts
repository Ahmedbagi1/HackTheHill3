import { useMemo } from "react";
import { useI18n } from "./i18nContext";

/** Language bundle for lib/formatting.js and lib/reviewPacket.js. */
export function useAnswerLanguage() {
  const { t, info, formatDate } = useI18n();
  return useMemo(
    () => ({
      t,
      intl: info.intl,
      htmlLang: info.htmlLang,
      formatDate: (isoDate: string) => formatDate(`${isoDate}T12:00:00`, "date"),
    }),
    [t, info, formatDate],
  );
}
