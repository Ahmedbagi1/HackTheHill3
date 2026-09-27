import type { ReactNode } from "react";
import { Baby, Building2, HeartPulse, House, Landmark, LayoutGrid, MapPinned, PiggyBank, Siren, X } from "lucide-react";
import AccountButton from "../../components/account/AccountButton";
import { PROVINCES } from "../../data/provinces";
import { useI18n } from "../../i18n/i18nContext";
import type { ModuleRoute, Route } from "../../state/useHashRoute";
import type { ProvinceCode } from "../../types/dashboard";
import type { TierFilter } from "../../types/directory";
import AccessibilityToggle from "./AccessibilityToggle";
import LanguagePicker from "./LanguagePicker";

interface Props {
  route: Route;
  tier: TierFilter;
  tierCounts: Record<TierFilter, number>;
  province: ProvinceCode;
  alertCount: number;
  open: boolean;
  onClose: () => void;
  onSelectTier: (tier: TierFilter) => void;
  onSelectProvince: (province: ProvinceCode) => void;
  onNavigate: (route: Route) => void;
  onOpenFinder: () => void;
}

function NavItem({
  icon,
  label,
  count,
  active = false,
  onClick,
  tag,
}: {
  icon: ReactNode;
  label: string;
  count?: number;
  active?: boolean;
  onClick: () => void;
  tag?: string;
}) {
  return (
    <button type="button" className={`side-item${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined} onClick={onClick}>
      <span className="side-item__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="side-item__label">{label}</span>
      {tag && <span className="side-item__tag">{tag}</span>}
      {count !== undefined && <span className="side-item__count">{count}</span>}
    </button>
  );
}

const MODULE_ITEMS: Array<{ route: ModuleRoute; label: string; Icon: typeof House }> = [
  { route: "housing", label: "Subsidized housing", Icon: House },
  { route: "doctor", label: "Find a family doctor", Icon: HeartPulse },
  { route: "autism", label: "Autism support", Icon: Baby },
];

export default function Sidebar({
  route,
  tier,
  tierCounts,
  province,
  alertCount,
  open,
  onClose,
  onSelectTier,
  onSelectProvince,
  onNavigate,
  onOpenFinder,
}: Props) {
  const { t } = useI18n();
  const onHub = route === "dashboard";
  const tierActive = (value: TierFilter) => onHub && tier === value;

  return (
    <>
      <div className={`sidebar-scrim${open ? " is-open" : ""}`} onClick={onClose} aria-hidden="true" />
      <aside id="sidebar" className={`sidebar${open ? " is-open" : ""}`} aria-label={t("Main navigation")}>
        <div className="sidebar__top">
          <div className="sidebar__brand-row">
            <a
              className="sidebar__brand"
              href="#/"
              onClick={(e) => {
                e.preventDefault();
                onSelectTier("all");
              }}
            >
              <span className="brand__mark" aria-hidden="true">
                <Landmark size={18} />
              </span>
              <span className="sidebar__name">CivicOS</span>
              <span className="sidebar__badge">{t("Citizen Hub")}</span>
            </a>
            <button type="button" className="icon-btn sidebar__close" aria-label={t("Close menu")} onClick={onClose}>
              <X size={18} />
            </button>
          </div>

          <nav className="sidebar__nav" aria-label={t("Services")}>
            <p className="sidebar__section">{t("Services")}</p>
            <NavItem icon={<LayoutGrid size={18} />} label={t("All services")} count={tierCounts.all} active={tierActive("all")} onClick={() => onSelectTier("all")} />
            <NavItem
              icon={<Landmark size={18} />}
              label={t("Federal (Canada)")}
              count={tierCounts.federal}
              active={tierActive("federal")}
              onClick={() => onSelectTier("federal")}
            />
            <div className={`side-group${tierActive("provincial") ? " is-active" : ""}`}>
              <NavItem
                icon={<MapPinned size={18} />}
                label={t("Provincial / Territorial")}
                count={tierCounts.provincial}
                active={tierActive("provincial")}
                onClick={() => onSelectTier("provincial")}
              />
              <label className="side-group__picker">
                <span className="side-group__picker-label">{t("Province or territory")}</span>
                <select value={province} onChange={(e) => onSelectProvince(e.target.value as ProvinceCode)}>
                  {PROVINCES.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.code} · {t(p.name)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <NavItem
              icon={<Building2 size={18} />}
              label={t("Municipal (Ottawa)")}
              count={tierCounts.municipal}
              active={tierActive("municipal")}
              onClick={() => onSelectTier("municipal")}
            />

            <p className="sidebar__section">{t("Updates")}</p>
            <NavItem
              icon={<Siren size={18} />}
              label={t("Disruptions & Alerts")}
              count={alertCount}
              active={route === "alerts"}
              onClick={() => onNavigate("alerts")}
            />

            <p className="sidebar__section">{t("Programs")}</p>
            {MODULE_ITEMS.map(({ route: target, label, Icon }) => (
              <NavItem key={target} icon={<Icon size={18} />} label={t(label)} tag="ON" active={route === target} onClick={() => onNavigate(target)} />
            ))}
            <NavItem icon={<PiggyBank size={18} />} label={t("Money you might be missing")} onClick={onOpenFinder} />
          </nav>
        </div>

        <div className="sidebar__bottom">
          <LanguagePicker variant="sidebar" />
          <AccessibilityToggle />
          <AccountButton variant="pill" />
        </div>
      </aside>
    </>
  );
}
