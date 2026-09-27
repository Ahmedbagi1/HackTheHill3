import { useLanguage } from "../../context/LanguageContext";
import { tierLabel } from "../../data/servicesData";

const TierBadge = ({ tier }) => {
  const { currentLang } = useLanguage();
  return <span className={`badge badge--${tier.toLowerCase()}`}>{tierLabel(tier, currentLang)}</span>;
};

export default TierBadge;
