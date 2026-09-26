import { Search, Sparkles, X } from "lucide-react";

const EXAMPLES = ["Lost wallet", "Starting a business", "Having a baby", "Moving", "Lost my job"];

const SearchBar = ({ value, onChange }) => (
  <div className="search-block">
    <div className="search search--large">
      <Search className="search__icon" size={20} aria-hidden="true" />
      <label htmlFor="service-search" className="sr-only">
        Search services or describe your situation
      </label>
      <input
        id="service-search"
        type="search"
        className="search__input"
        placeholder="Describe your situation, e.g. “I lost my wallet” or “starting a business”"
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
    <div className="search-examples" aria-label="Example searches">
      <Sparkles size={14} aria-hidden="true" />
      <span className="search-examples__label">Try:</span>
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

export default SearchBar;
