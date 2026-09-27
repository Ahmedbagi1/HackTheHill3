import { Info, Megaphone } from "lucide-react";
import SearchBar from "../../components/common/SearchBar";
import { ALERTS } from "../../data/alerts";
import { PROVINCES_BY_CODE } from "../../data/provinces";
import { greeting } from "../../lib/time";
import { SectionCard } from "../../components/ui/primitives";
import { useCivicData } from "../../state/civicDataStore";
import type { LoadState, NewsFeed as NewsData } from "../../state/useCivicFeeds";
import type { WasteState } from "../../state/wasteSchedule";
import type { ModuleRoute } from "../../state/useHashRoute";
import type { RegionalAlertFeed } from "../../types/alerts";
import type { DisruptionFeed as DisruptionData, UserRequest, WasteRotation } from "../../types/dashboard";
import type { IntentId } from "../../types/directory";
import RegionalAlerts from "../alerts/RegionalAlerts";
import QuickIntents from "../directory/QuickIntents";
import RequestTracker from "./RequestTracker";
import ProgramShortcuts from "./ProgramShortcuts";
import DisruptionFeed from "./DisruptionFeed";
import NewsFeed from "./NewsFeed";
import WasteRail from "./WasteRail";

interface Props {
  /** Typing in the hero search opens the service directory with the query. */
  onSearch: (query: string) => void;
  onSelectIntent: (intent: IntentId) => void;
  intentCounts: Record<IntentId, number>;
  onOpenModule: (route: ModuleRoute) => void;
  onOpenFinder: () => void;
  onBrowse: () => void;
  onOpenRequest: (request: UserRequest) => void;
  alerts: LoadState<RegionalAlertFeed> & { refresh: () => void };
  disruptions: LoadState<DisruptionData> & { refresh: () => void };
  news: LoadState<NewsData>;
  waste: { state: WasteState; rotation: WasteRotation | null; setRotation: (r: WasteRotation | null) => void };
}

export default function CitizenDashboard({
  onSearch,
  onSelectIntent,
  intentCounts,
  onOpenModule,
  onOpenFinder,
  onBrowse,
  onOpenRequest,
  alerts,
  disruptions,
  news,
  waste,
}: Props) {
  const { displayName, requests, location, setLocation, withdrawRequest, seedDemo, clearDemo } = useCivicData();
  const province = PROVINCES_BY_CODE[location.province];
  const demo = requests.some((r) => r.demo);

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
            <Info size={14} aria-hidden="true" /> Federal services work everywhere in Canada. Provincial and municipal services
            are available for Ontario and Ottawa today.
          </p>
        )}
        <SearchBar value="" onChange={onSearch}>
          <QuickIntents active={null} counts={intentCounts} onSelect={onSelectIntent} />
        </SearchBar>
      </section>

      <div className="dash-grid">
        <div className="dash-main">
          <RequestTracker
            requests={requests}
            onOpen={onOpenRequest}
            onWithdraw={(r) => {
              if (r.persistence === 'supabase') { onOpenRequest(r); return; }
              if (window.confirm(`Withdraw "${r.title}" from your dashboard?`)) withdrawRequest(r.id);
            }}
            onSeedDemo={seedDemo}
            onClearDemo={clearDemo}
            onBrowse={onBrowse}
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
          <div className="pulse__col">
            <RegionalAlerts key={location.province} feed={alerts} defaultRegion={location.province} demo={demo} />
            {province.fullCoverage && <DisruptionFeed feed={disruptions} coverage nearLabel={nearLabel} />}
          </div>
          <NewsFeed feed={news} provinceName={province.name} />
        </div>
      </section>
    </main>
  );
}
