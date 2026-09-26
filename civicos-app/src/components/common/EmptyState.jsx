import { SearchX } from "lucide-react";

const EmptyState = ({ query, tier, onReset }) => (
  <div className="empty-state">
    <span className="empty-state__icon" aria-hidden="true">
      <SearchX size={22} />
    </span>
    <p className="empty-state__title">No services found</p>
    <p className="empty-state__text">
      {query
        ? `Nothing ${tier === "All" ? "" : `at the ${tier.toLowerCase()} level `}matches “${query}”. Try describing your situation differently.`
        : `There are no ${tier.toLowerCase()} services yet.`}
    </p>
    <button type="button" className="btn btn--secondary" onClick={onReset}>
      Clear filters
    </button>
  </div>
);

export default EmptyState;
