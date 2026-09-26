import { useState } from "react";
import { Info, SearchX } from "lucide-react";
import SearchBar from "../../components/common/SearchBar";
import ServiceCard from "../../components/dashboard/ServiceCard";
import LifeEventChecklist from "../../components/dashboard/LifeEventChecklist";
import { CATEGORIES, type ModuleEntry } from "../../data/categories";
import { INTENTS_BY_ID } from "../../data/intents";
import { SERVICES_BY_ID } from "../../data/servicesData";
import { PROVINCES_BY_CODE } from "../../data/provinces";
import type { CatalogService, DirectoryItem, DirectoryResult } from "../../lib/directory";
import type { ProvinceCode } from "../../types/dashboard";
import type { DirectoryFilters, TierFilter } from "../../types/directory";
import QuickIntents from "./QuickIntents";
import { ModuleCard, PortalCard } from "./DirectoryCards";

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

function heading(tier: TierFilter, provinceName: string): { title: string; lede: string } {
  switch (tier) {
    case "federal":
      return { title: "Federal services (Canada)", lede: "Programs from the Government of Canada, available wherever you live." };
    case "provincial":
      return {
        title: `Provincial services · ${provinceName}`,
        lede: `Health cards, licences, income support and more in ${provinceName}.`,
      };
    case "municipal":
      return {
        title: "Municipal services · City of Ottawa",
        lede: "Waste, taxes, permits, parking, transit and 3-1-1 requests.",
      };
    default:
      return {
        title: "All services",
        lede: "Every federal, provincial and municipal service in one place. Search or pick a topic.",
      };
  }
}

export default function ServiceDirectory({
  filters,
  directory,
  locationProvince,
  onChange,
  onReset,
  onStartService,
  onListen,
  onOpenModule,
}: Props) {
  // Focus the search box only when the visitor arrived by typing.
  const [focusOnMount] = useState(() => filters.query.trim().length > 0);
  const province = PROVINCES_BY_CODE[directory.province];
  const { title, lede } = heading(filters.tier, province.name);
  const { items, ranked, lifeEvent, stepByServiceId } = directory;
  const filtered = filters.query.trim() !== "" || filters.intent !== "all" || filters.tier !== "all";
  const outsideCatalog = directory.province !== "ON" && filters.tier !== "federal" && filters.tier !== "municipal";

  const renderItem = (item: DirectoryItem) => {
    switch (item.kind) {
      case "service":
        return (
          <ServiceCard
            key={item.id}
            service={item.service}
            stepNumber={stepByServiceId.get(item.id)}
            onStart={onStartService}
            onListen={onListen}
          />
        );
      case "module":
        return <ModuleCard key={item.id} module={item.module} onOpen={onOpenModule} />;
      case "portal":
        return <PortalCard key={item.id} portal={item.portal} />;
    }
  };

  const groups = CATEGORIES.map((category) => ({ category, items: items.filter((i) => i.category === category.id) })).filter(
    (g) => g.items.length > 0,
  );

  const summary = [
    filters.intent !== "all" ? INTENTS_BY_ID[filters.intent].label : null,
    filters.query.trim() ? `matching “${filters.query.trim()}”` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <main id="main" className="directory">
      <section className="dir-hero" aria-labelledby="dir-title">
        <p className="dir-hero__eyebrow">Service directory</p>
        <h1 id="dir-title" className="dir-hero__title">
          {title}
        </h1>
        <p className="dir-hero__lede">{lede}</p>
        <SearchBar value={filters.query} onChange={(query: string) => onChange({ query })} autoFocus={focusOnMount}>
          <QuickIntents active={filters.intent} counts={directory.intentCounts} onSelect={(intent) => onChange({ intent })} />
        </SearchBar>
      </section>

      {outsideCatalog && (
        <p className="coverage-note">
          <Info size={14} aria-hidden="true" /> CivicOS applications cover Ontario today. For {province.name}, these open the
          official provincial or territorial service.
        </p>
      )}
      {locationProvince !== "ON" && filters.tier === "municipal" && (
        <p className="coverage-note">
          <Info size={14} aria-hidden="true" /> Municipal services are for residents of the City of Ottawa.
        </p>
      )}

      {lifeEvent && (
        <LifeEventChecklist
          key={lifeEvent.id}
          lifeEvent={lifeEvent}
          servicesById={SERVICES_BY_ID}
          onStart={onStartService}
          onListen={onListen}
        />
      )}

      <div className="dir-toolbar">
        <p className="results-meta" aria-live="polite">
          Showing <strong>{items.length}</strong> service{items.length === 1 ? "" : "s"}
          {summary && <span className="dir-toolbar__filters"> · {summary}</span>}
        </p>
        {filtered && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={onReset}>
            Clear filters
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state__icon" aria-hidden="true">
            <SearchX size={22} />
          </span>
          <p className="empty-state__title">No services match these filters</p>
          <p className="empty-state__text">Try different words, another topic, or all levels of government.</p>
          <button type="button" className="btn btn--secondary" onClick={onReset}>
            Clear filters
          </button>
        </div>
      ) : ranked ? (
        <div className="grid">{items.map(renderItem)}</div>
      ) : (
        groups.map(({ category, items: groupItems }) => (
          <section key={category.id} className="dir-group" aria-labelledby={`group-${category.id}`}>
            <h2 id={`group-${category.id}`} className="dir-group__title">
              {category.label}
              <span className="dir-group__count">{groupItems.length}</span>
            </h2>
            <p className="dir-group__description">{category.description}</p>
            <div className="grid">{groupItems.map(renderItem)}</div>
          </section>
        ))
      )}
    </main>
  );
}
