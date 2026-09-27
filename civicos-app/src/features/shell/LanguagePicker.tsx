import { Languages } from "lucide-react";
import { useId } from "react";
import { useI18n } from "../../i18n/i18nContext";
import { LOCALES, type Locale } from "../../i18n/locales";

interface Props {
  /** `sidebar`: labelled full-width control. `pill`: compact header control. */
  variant: "sidebar" | "pill";
}

/** Native select so it works with keyboards, screen readers and mobile pickers. */
export default function LanguagePicker({ variant }: Props) {
  const { locale, setLocale, t, info } = useI18n();
  const id = useId();

  return (
    <div className={`lang-picker lang-picker--${variant}`}>
      <label htmlFor={id} className={variant === "pill" ? "sr-only" : "lang-picker__label"}>
        {t("Language")}
      </label>
      <div className="lang-picker__control">
        <Languages size={variant === "pill" ? 15 : 16} aria-hidden="true" className="lang-picker__icon" />
        <select id={id} value={locale} onChange={(e) => setLocale(e.target.value as Locale)} title={info.englishName}>
          {LOCALES.map((l) => (
            <option key={l.code} value={l.code} lang={l.htmlLang}>
              {l.nativeName}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
