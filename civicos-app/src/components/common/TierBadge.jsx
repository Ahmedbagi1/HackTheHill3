const TierBadge = ({ tier }) => (
  <span className={`badge badge--${tier.toLowerCase()}`}>{tier}</span>
);

export default TierBadge;
