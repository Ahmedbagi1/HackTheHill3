const TierTabs = ({ tiers, active, counts, onChange }) => {
  const handleKeyDown = (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const delta = e.key === "ArrowRight" ? 1 : -1;
    const next = tiers[(tiers.indexOf(active) + delta + tiers.length) % tiers.length];
    onChange(next);
    e.currentTarget.querySelector(`[data-tier="${next}"]`)?.focus();
  };

  return (
    <div className="tabs" role="tablist" aria-label="Filter by level of government" onKeyDown={handleKeyDown}>
      {tiers.map((tier) => {
        const isActive = tier === active;
        return (
          <button
            key={tier}
            type="button"
            role="tab"
            data-tier={tier}
            aria-selected={isActive}
            aria-controls="service-results"
            tabIndex={isActive ? 0 : -1}
            className={`tab${isActive ? " tab--active" : ""}`}
            onClick={() => onChange(tier)}
          >
            {tier}
            <span className="tab__count">{counts[tier] ?? 0}</span>
          </button>
        );
      })}
    </div>
  );
};

export default TierTabs;
