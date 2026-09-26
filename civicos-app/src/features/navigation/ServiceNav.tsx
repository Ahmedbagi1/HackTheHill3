import { Building2, House, Landmark, LayoutGrid, MapPinned } from "lucide-react";
import type { ReactNode } from "react";
import { PROVINCES } from "../../data/provinces";
import type { ProvinceCode } from "../../types/dashboard";
import type { TierFilter } from "../../types/directory";
import type { Route } from "../../state/useHashRoute";

interface Props {
  route: Route;
  tier: TierFilter;
  counts: Record<TierFilter, number>;
  province: ProvinceCode;
  onHome: () => void;
  onSelectTier: (tier: TierFilter) => void;
  onSelectProvince: (province: ProvinceCode) => void;
}

function NavTab({
  active,
  onClick,
  icon,
  label,
  qualifier,
  count,
  className = "",
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  qualifier?: string;
  count?: number;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`snav__tab ${className}${active ? " is-active" : ""}`}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
    >
      <span className="snav__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="snav__label">
        {label}
        {qualifier && <span className="snav__qualifier"> ({qualifier})</span>}
      </span>
      {count !== undefined && <span className="snav__count">{count}</span>}
    </button>
  );
}

/**
 * Sticky primary navigation for service discovery, directly above page content.
 * Tabs filter the directory by level of government; the Provincial / Territorial
 * tab carries its own province picker.
 */
export default function ServiceNav({ route, tier, counts, province, onHome, onSelectTier, onSelectProvince }: Props) {
  const inDirectory = route === "services";
  const is = (t: TierFilter) => inDirectory && tier === t;

  return (
    <nav className="snav" aria-label="Services">
      <div className="snav__inner">
        <NavTab
          active={route === "dashboard"}
          onClick={onHome}
          icon={<House size={16} />}
          label="Home"
          className="snav__tab--home"
        />
        <span className="snav__divider" aria-hidden="true" />
        <NavTab
          active={is("all")}
          onClick={() => onSelectTier("all")}
          icon={<LayoutGrid size={16} />}
          label="All services"
          count={counts.all}
          className="snav__tab--all"
        />
        <NavTab
          active={is("federal")}
          onClick={() => onSelectTier("federal")}
          icon={<Landmark size={16} />}
          label="Federal"
          qualifier="Canada"
          count={counts.federal}
        />
        <div className={`snav__group${is("provincial") ? " is-active" : ""}`}>
          <NavTab
            active={is("provincial")}
            onClick={() => onSelectTier("provincial")}
            icon={<MapPinned size={16} />}
            label="Provincial / Territorial"
            count={counts.provincial}
          />
          <label className="sr-only" htmlFor="snav-province">
            Province or territory
          </label>
          <select
            id="snav-province"
            className="snav__select"
            value={province}
            onChange={(e) => onSelectProvince(e.target.value as ProvinceCode)}
          >
            {PROVINCES.map((p) => (
              <option key={p.code} value={p.code} aria-label={p.name}>
                {p.code}
              </option>
            ))}
          </select>
        </div>
        <NavTab
          active={is("municipal")}
          onClick={() => onSelectTier("municipal")}
          icon={<Building2 size={16} />}
          label="Municipal"
          qualifier="Ottawa"
          count={counts.municipal}
        />
      </div>
    </nav>
  );
}
