import { useI18n } from "../../i18n/i18nContext";

const TierBadge = ({ tier }) => {
  const { t } = useI18n();
  return <span className={`badge badge--${tier.toLowerCase()}`}>{t(tier)}</span>;
};

export default TierBadge;
