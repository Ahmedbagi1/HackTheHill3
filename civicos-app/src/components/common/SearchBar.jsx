import { useEffect, useRef } from "react";
import { Search, Sparkles, X } from "lucide-react";

const EXAMPLES = ["Lost wallet", "Starting a business", "Having a baby", "Moving", "Lost my job"];

/**
 * Prominent service search. `children` render directly under the input
 * (quick-intent chips); life-event examples follow.
 *
 * @param {{ value: string, onChange: (value: string) => void, autoFocus?: boolean, children?: import("react").ReactNode }} props
 */
const SearchBar = ({ value, onChange, autoFocus = false, children = null }) => {
  const inputRef = useRef(null);

  useEffect(() => {
    if (!autoFocus || !inputRef.current) return;
    const input = inputRef.current;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }, [autoFocus]);

  return (
    <div className="search-block">
      <div className="search search--large">
        <Search className="search__icon" size={20} aria-hidden="true" />
        <label htmlFor="service-search" className="sr-only">
          Search services or describe your situation
        </label>
        <input
          ref={inputRef}
          id="service-search"
          type="search"
          className="search__input"
          placeholder="Search services or describe your situation, e.g. “I lost my wallet”"
          value={value}
          autoComplete="off"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onChange("");
          }}
        />
        {value && (
          <button type="button" className="search__clear" aria-label="Clear search" onClick={() => onChange("")}>
            <X size={16} />
          </button>
        )}
      </div>
      {children}
      <div className="search-examples" aria-label="Example searches">
        <Sparkles size={14} aria-hidden="true" />
        <span className="search-examples__label">Try a situation:</span>
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
