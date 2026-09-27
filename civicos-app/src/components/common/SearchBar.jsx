import { useEffect, useRef } from "react";
import { LoaderCircle, Search, Sparkles, X } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { isTriageQuery } from "../../services/api/gemini/geminiTriage";

// Examples stay in English: the search engine matches English catalog text.
const EXAMPLES = ["Lost wallet", "Starting a business", "Having a baby", "Moving", "Lost my job"];

/**
 * Prominent service search. `children` render directly under the input
 * (quick-intent chips); life-event examples follow.
 *
 * When `onTriage` is set, a "Smart Triage" button (and Enter, for queries of
 * more than three words) sends the description to Gemini triage.
 *
 * @param {{
 *   value: string,
 *   onChange: (value: string) => void,
 *   autoFocus?: boolean,
 *   children?: import("react").ReactNode,
 *   onTriage?: (query: string) => void,
 *   triageBusy?: boolean,
 * }} props
 */
const SearchBar = ({ value, onChange, autoFocus = false, children = null, onTriage = undefined, triageBusy = false }) => {
  const { t } = useLanguage();
  const inputRef = useRef(null);

  useEffect(() => {
    if (!autoFocus || !inputRef.current) return;
    const input = inputRef.current;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }, [autoFocus]);

  return (
    <div className="search-block">
      <div className={`search search--large${onTriage ? " search--triage" : ""}`}>
        <Search className="search__icon" size={20} aria-hidden="true" />
        <label htmlFor="service-search" className="sr-only">
          {t("Search services or describe your situation", "Rechercher des services ou décrire votre situation")}
        </label>
        <input
          ref={inputRef}
          id="service-search"
          type="search"
          className="search__input"
          placeholder={t("search.placeholder")}
          value={value}
          autoComplete="off"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onChange("");
            if (e.key === "Enter" && onTriage && !triageBusy && isTriageQuery(value)) {
              e.preventDefault();
              onTriage(value);
            }
          }}
        />
        {value && (
          <button type="button" className="search__clear" aria-label={t("Clear search", "Effacer la recherche")} onClick={() => onChange("")}>
            <X size={16} />
          </button>
        )}
        {onTriage && (
          <button
            type="button"
            className="search__triage"
            onClick={() => onTriage(value)}
            disabled={triageBusy || !value.trim()}
            title={t("Describe your situation and let AI map the services you need", "Décrivez votre situation et laissez l'IA trouver les services requis")}
          >
            {triageBusy ? <LoaderCircle size={15} className="spin" aria-hidden="true" /> : <Sparkles size={15} aria-hidden="true" />}
            <span>{t("Smart Triage", "Triage intelligent")}</span>
          </button>
        )}
      </div>
      {children}
      <div className="search-examples" aria-label={t("Example searches", "Exemples de recherche")}>
        <Sparkles size={14} aria-hidden="true" />
        <span className="search-examples__label">{t("Try a situation:", "Essayez une situation :")}</span>
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            className={`chip${value.trim().toLowerCase() === example.toLowerCase() ? " chip--active" : ""}`}
            onClick={() => onChange(example)}
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
};

export default SearchBar;
