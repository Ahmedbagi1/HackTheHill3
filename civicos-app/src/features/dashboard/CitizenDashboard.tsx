import { useMemo, useState } from "react";
import { Info, Megaphone } from "lucide-react";
import SearchBar from "../../components/common/SearchBar";
import TierTabs from "../../components/common/TierTabs";
import LifeEventChecklist from "../../components/dashboard/LifeEventChecklist";
import ServicesGrid from "../../components/dashboard/ServicesGrid";
import { ALERTS } from "../../data/alerts";
import { LIFE_EVENTS } from "../../data/lifeEvents";
import { SERVICES, SERVICES_BY_ID, TIERS } from "../../data/servicesData";
import { PROVINCES_BY_CODE } from "../../data/provinces";
import { searchCatalog } from "../../lib/search";
import { greeting } from "../../lib/time";
import { SectionCard } from "../../components/ui/primitives";
import { useCivicData } from "../../state/civicDataStore";
import type { LoadState, NewsFeed as NewsData } from "../../state/useCivicFeeds";
import type { WasteState } from "../../state/wasteSchedule";
import type { Route } from "../../state/useHashRoute";
import type { DisruptionFeed as DisruptionData, UserRequest, WasteRotation } from "../../types/dashboard";
import RequestTracker from "./RequestTracker";
import ProgramShortcuts from "./ProgramShortcuts";
import DisruptionFeed from "./DisruptionFeed";
import NewsFeed from "./NewsFeed";
import WasteRail from "./WasteRail";

type CatalogService = (typeof SERVICES)[number];
type LifeEvent = (typeof LIFE_EVENTS)[number];

/** Typed boundary over the JS search engine (lib/search.js). */
interface SearchResult {
  lifeEvent: LifeEvent | null;
  results: CatalogService[];
  stepByServiceId: Map<string, number>;
}

const TABS = ["All", ...TIERS];

interface Props {
  onStartService: (service: CatalogService) => void;
  onListen: (service: CatalogService) => void;
  onOpenModule: (route: Exclude<Route, "dashboard">) => void;
  onOpenFinder: () => void;
  onOpenHub: () => void;
  onOpenRequest: (request: UserRequest) => void;
  disruptions: LoadState<DisruptionData> & { refresh: () => void };
  news: LoadState<NewsData>;
  waste: { state: WasteState; rotation: WasteRotation | null; setRotation: (r: WasteRotation | null) => void };
}

export default function CitizenDashboard({
  onStartService,
  onListen,
  onOpenModule,
  onOpenFinder,
  onOpenHub,
  onOpenRequest,
  disruptions,
  news,
  waste,
}: Props) {
  const { displayName, requests, location, setLocation, withdrawRequest, seedDemo, clearDemo } = useCivicData();
  const province = PROVINCES_BY_CODE[location.province];
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState("All");

  const search = useMemo(() => searchCatalog(query, SERVICES, LIFE_EVENTS) as SearchResult, [query]);
  const visible = tier === "All" ? search.results : search.results.filter((s) => s.tier === tier);
  const counts = useMemo(
    () => Object.fromEntries(TABS.map((t) => [t, t === "All" ? search.results.length : search.results.filter((s) => s.tier === t).length])),
    [search.results],
  );

  const today = new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric" }).format(new Date());
  const pending = requests.filter((r) => r.actionRequired).length;
  const nearLabel = waste.state.status === "ready" ? "your address" : null;

  return (
    <main id="main" className="dash">
      <section className="dash-hero">
        <p className="dash-hero__date">{today}</p>
        <h1 className="dash-hero__title">
          {greeting()}
          {displayName ? `, ${displayName}` : ""}.
        </h1>
        <p className="dash-hero__lede">
          {pending > 0
            ? `${pending} of your requests need attention. Everything else is on track.`
            : requests.length > 0
              ? "Your requests are on track. Here's what's happening around you."
              : "Find a service, check what you qualify for, and see what's happening around you."}
        </p>
        {!province.fullCoverage && (
          <p className="coverage-note">
            <Info size={14} aria-hidden="true" /> Federal services work everywhere in Canada. Provincial and municipal services are available for
            Ontario and Ottawa today.
          </p>
        )}
        <SearchBar value={query} onChange={setQuery} />
      </section>

      {query.trim() ? (
        <section className="dash-search" aria-label="Search results">
          {search.lifeEvent && (
            <LifeEventChecklist
              key={search.lifeEvent.id}
              lifeEvent={search.lifeEvent}
              servicesById={SERVICES_BY_ID}
              onStart={onStartService}
              onListen={onListen}
            />
          )}
          <div className="toolbar">
            <TierTabs tiers={TABS} active={tier} counts={counts} onChange={setTier} />
            <p className="results-meta" aria-live="polite">
              <strong>{visible.length}</strong> matching services
            </p>
          </div>
          <ServicesGrid
            services={visible}
            stepByServiceId={search.stepByServiceId}
            query={query.trim()}
            tier={tier}
            onStart={onStartService}
            onListen={onListen}
            onReset={() => {
              setQuery("");
              setTier("All");
            }}
          />
        </section>
      ) : (
        <>
          <div className="dash-grid">
            <div className="dash-main">
              <RequestTracker
                requests={requests}
                onOpen={onOpenRequest}
                onWithdraw={(r) => {
                  if (window.confirm(`Withdraw "${r.title}" from your dashboard?`)) withdrawRequest(r.id);
                }}
                onSeedDemo={seedDemo}
                onClearDemo={clearDemo}
                onBrowse={onOpenHub}
              />
              <ProgramShortcuts enabled={province.fullCoverage} onOpenModule={onOpenModule} onOpenFinder={onOpenFinder} />
            </div>
            <aside className="dash-rail" aria-label="Local services">
              <WasteRail
                coverage={province.fullCoverage}
                address={location.address}
                onSaveAddress={(address) => setLocation({ address })}
                state={waste.state}
                rotation={waste.rotation}
                onSetRotation={waste.setRotation}
              />
              <SectionCard id="updates" title="Program updates" icon={<Megaphone size={16} />}>
                <ul className="updates">
                  {ALERTS.map((alert) => (
                    <li key={alert.id} className="update">
                      <span className={`alert__dot alert__dot--${alert.tone}`} aria-hidden="true" />
                      <p>
                        <strong>{alert.tier}</strong> {alert.text}
                      </p>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            </aside>
          </div>

          <section className="pulse" aria-labelledby="pulse-title">
            <h2 id="pulse-title" className="pulse__title">
              Civic pulse
            </h2>
            <div className="pulse__grid">
              <DisruptionFeed feed={disruptions} coverage={province.fullCoverage} nearLabel={nearLabel} />
              <NewsFeed feed={news} provinceName={province.name} />
            </div>
          </section>
        </>
      )}
    </main>
  );
}
