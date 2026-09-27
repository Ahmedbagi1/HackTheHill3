import { Building2, Info, Landmark, LayoutGrid, MapPinned, SearchX } from "lucide-react";
import type { ReactNode } from "react";
import ServiceCard from "../../components/dashboard/ServiceCard";
import LifeEventChecklist from "../../components/dashboard/LifeEventChecklist";
import { CATEGORIES, type ModuleEntry } from "../../data/categories";
import { INTENTS_BY_ID } from "../../data/intents";
import { PROVINCES, PROVINCES_BY_CODE } from "../../data/provinces";
import { SERVICES_BY_ID } from "../../data/servicesData";
import { useI18n } from "../../i18n/i18nContext";
import type { CatalogService, DirectoryItem, DirectoryResult } from "../../lib/directory";
import type { ProvinceCode } from "../../types/dashboard";
import type { DirectoryFilters, TierFilter } from "../../types/directory";
import { ModuleCard, PortalCard } from "../directory/DirectoryCards";
import QuickIntents from "../directory/QuickIntents";

interface Props {
  filters: DirectoryFilters;
  directory: DirectoryResult;
  locationProvince: ProvinceCode;
  onChange: (patch: Partial<DirectoryFilters>) => void;
  onReset: () => void;
  onStartService: (service: CatalogService) => void;
  onListen: (service: CatalogService) => void;
  onOpenModule: (id: ModuleEntry["id"]) => void;
}

const TIER_TABS: Array<{ id: TierFilter; label: string; icon: ReactNode }> = [
  { id: "all", label: "All services", icon: <LayoutGrid size={15} /> },
  { id: "federal", label: "Federal (Canada)", icon: <Landmark size={15} /> },
  { id: "provincial", label: "Provincial / Territorial", icon: <MapPinned size={15} /> },
  { id: "municipal", label: "Municipal (Ottawa)", icon: <Building2 size={15} /> },
];

/** "Available services": level-of-government tabs, topic pills and the card grid. */
export default function ServicesSection({ filters, directory, locationProvince, onChange, onReset, onStartService, onListen, onOpenModule }: Props) {
  const { t, tp } = useI18n();
  const province = PROVINCES_BY_CODE[directory.province];
  const { items, ranked, lifeEvent, stepByServiceId } = directory;
  const query = filters.query.trim();
  const filtered = query !== "" || filters.intent !== "all" || filters.tier !== "all";
  const outsideCatalog = directory.province !== "ON" && filters.tier !== "federal" && filters.tier !== "municipal";

  const renderItem = (item: DirectoryItem) => {
    switch (item.kind) {
      case "service":
        return <ServiceCard key={item.id} service={item.service} stepNumber={stepByServiceId.get(item.id)} onStart={onStartService} onListen={onListen} />;
      case "module":
        return <ModuleCard key={item.id} module={item.module} onOpen={onOpenModule} />;
      case "portal":
        return <PortalCard key={item.id} portal={item.portal} />;
    }
  };

  const groups = CATEGORIES.map((category) => ({ category, items: items.filter((i) => i.category === category.id) })).filter((g) => g.items.length > 0);

  return (
    <section id="services" className="hub-section" aria-labelledby="services-title">
      <div className="hub-section__head">
        <div>
          <h2 id="services-title" className="hub-section__title">
            {t("Available services")}
          </h2>
          <p className="hub-section__lede">{t("Every federal, provincial and municipal service in one place. Search or pick a topic.")}</p>
        </div>
      </div>

      <div className="tier-tabs" role="group" aria-label={t("Level of government")}>
        {TIER_TABS.map((tab) => {
          const active = filters.tier === tab.id;
          return (
            <button key={tab.id} type="button" className={`tier-tab${active ? " is-active" : ""}`} aria-pressed={active} onClick={() => onChange({ tier: tab.id })}>
              <span aria-hidden="true">{tab.icon}</span>
              {t(tab.label)}
              <span className="tier-tab__count">{directory.tierCounts[tab.id]}</span>
            </button>
          );
        })}
        <label className="tier-tabs__province">
          <span className="sr-only">{t("Province or territory")}</span>
          <select value={directory.province} onChange={(e) => onChange({ province: e.target.value as ProvinceCode, tier: "provincial" })}>
            {PROVINCES.map((p) => (
              <option key={p.code} value={p.code}>
                {t(p.name)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <QuickIntents active={filters.intent} counts={directory.intentCounts} onSelect={(intent) => onChange({ intent })} />

      {outsideCatalog && (
        <p className="coverage-note">
          <Info size={14} aria-hidden="true" />
          {t("CivicOS applications cover Ontario today. For {province}, these open the official provincial or territorial service.", { province: t(province.name) })}
        </p>
      )}
      {locationProvince !== "ON" && filters.tier === "municipal" && (
        <p className="coverage-note">
          <Info size={14} aria-hidden="true" /> {t("Municipal services are for residents of the City of Ottawa.")}
        </p>
      )}

      {lifeEvent && <LifeEventChecklist key={lifeEvent.id} lifeEvent={lifeEvent} servicesById={SERVICES_BY_ID} onStart={onStartService} onListen={onListen} />}

      <div className="dir-toolbar">
        <p className="results-meta" aria-live="polite">
          {tp("Showing {count} service", "Showing {count} services", items.length)}
          {filters.intent !== "all" && <span className="dir-toolbar__filters"> · {t(INTENTS_BY_ID[filters.intent].label)}</span>}
          {query && <span className="dir-toolbar__filters"> · {t("matching “{query}”", { query })}</span>}
        </p>
        {filtered && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={onReset}>
            {t("Clear filters")}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state__icon" aria-hidden="true">
            <SearchX size={22} />
          </span>
          <p className="empty-state__title">{t("No services match these filters")}</p>
          <p className="empty-state__text">{t("Try different words, another topic, or all levels of government.")}</p>
          <button type="button" className="btn btn--secondary" onClick={onReset}>
            {t("Clear filters")}
          </button>
        </div>
      ) : ranked ? (
        <div className="grid">{items.map(renderItem)}</div>
      ) : (
        groups.map(({ category, items: groupItems }) => (
          <section key={category.id} className="dir-group" aria-labelledby={`group-${category.id}`}>
            <h3 id={`group-${category.id}`} className="dir-group__title">
              {t(category.label)}
              <span className="dir-group__count">{groupItems.length}</span>
            </h3>
            <p className="dir-group__description">{t(category.description)}</p>
            <div className="grid">{groupItems.map(renderItem)}</div>
          </section>
        ))
      )}
    </section>
  );
}
