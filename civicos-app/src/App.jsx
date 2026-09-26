import { useCallback, useMemo, useState } from "react";
import { ArrowRight, PiggyBank } from "lucide-react";
import Header from "./components/common/Header";
import NotificationBanner from "./components/common/NotificationBanner";
import SearchBar from "./components/common/SearchBar";
import TierTabs from "./components/common/TierTabs";
import CivicAlertsSidebar from "./components/dashboard/CivicAlertsSidebar";
import BenefitsFinder from "./components/finder/BenefitsFinder";
import LifeEventChecklist from "./components/dashboard/LifeEventChecklist";
import ServicesGrid from "./components/dashboard/ServicesGrid";
import ElevenLabsVoiceAssistant from "./components/voice/ElevenLabsVoiceAssistant";
import DynamicModalWizard from "./components/wizard/DynamicModalWizard";
import { ALERTS, BANNER_NOTICE } from "./data/alerts";
import { LIFE_EVENTS } from "./data/lifeEvents";
import { SERVICES, SERVICES_BY_ID, TIERS } from "./data/servicesData";
import { searchCatalog } from "./lib/search";

const TABS = ["All", ...TIERS];

const countByTier = (services) =>
  TABS.reduce((acc, tier) => {
    acc[tier] =
      tier === "All"
        ? services.length
        : services.filter((s) => s.tier === tier).length;
    return acc;
  }, {});

const TIER_TOTALS = countByTier(SERVICES);

function App() {
  const [query, setQuery] = useState("");
  const [activeTier, setActiveTier] = useState("All");
  const [wizard, setWizard] = useState(null); // { service, prefill }
  const [voiceService, setVoiceService] = useState(null);
  const [finderOpen, setFinderOpen] = useState(false);

  const { lifeEvent, results, stepByServiceId } = useMemo(
    () => searchCatalog(query, SERVICES, LIFE_EVENTS),
    [query],
  );
  const counts = useMemo(() => countByTier(results), [results]);
  const visibleServices = useMemo(
    () =>
      activeTier === "All"
        ? results
        : results.filter((s) => s.tier === activeTier),
    [results, activeTier],
  );

  const openWizard = useCallback((service, prefill = null) => {
    setVoiceService(null);
    setWizard({ service, prefill });
  }, []);
  const closeWizard = useCallback(() => setWizard(null), []);
  const openFinder = useCallback(() => setFinderOpen(true), []);
  const closeFinder = useCallback(() => setFinderOpen(false), []);
  const applyFromFinder = useCallback(
    (serviceId, prefill) => openWizard(SERVICES_BY_ID[serviceId], prefill),
    [openWizard],
  );
  const openVoice = useCallback((service) => setVoiceService(service), []);
  const closeVoice = useCallback(() => setVoiceService(null), []);

  const resetFilters = () => {
    setQuery("");
    setActiveTier("All");
  };

  return (
    <div className="app">
      <NotificationBanner
        notice={BANNER_NOTICE}
        actionLabel="Check what you qualify for"
        onAction={openFinder}
      />
      <Header alertCount={ALERTS.length} />

      <div className="page">
        <section className="hero">
          <h1 className="hero__title">What do you need to do today?</h1>
          <p className="hero__subtitle">
            {SERVICES.length} federal, Ontario and City of Ottawa services in
            one place. Describe your situation and we'll build a checklist
            across every level of government.
          </p>
          <SearchBar value={query} onChange={setQuery} />
          <button type="button" className="finder-cta" onClick={openFinder}>
            <span className="finder-cta__icon" aria-hidden="true">
              <PiggyBank size={20} />
            </span>
            <span className="finder-cta__text">
              <strong>Money you might be missing</strong>
              <span>
                Answer 5 questions to estimate your benefits across programs
              </span>
            </span>
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </section>

        {lifeEvent && (
          <LifeEventChecklist
            key={lifeEvent.id}
            lifeEvent={lifeEvent}
            servicesById={SERVICES_BY_ID}
            onStart={openWizard}
            onListen={openVoice}
          />
        )}

        <div className="layout">
          <main className="main">
            <div className="toolbar">
              <TierTabs
                tiers={TABS}
                active={activeTier}
                counts={counts}
                onChange={setActiveTier}
              />
              <p className="results-meta" aria-live="polite">
                Showing <strong>{visibleServices.length}</strong> of{" "}
                <strong>{SERVICES.length}</strong> services
                {lifeEvent && (
                  <> · highlighted steps match “{lifeEvent.title}”</>
                )}
              </p>
            </div>

            <ServicesGrid
              services={visibleServices}
              stepByServiceId={stepByServiceId}
              query={query.trim()}
              tier={activeTier}
              onStart={openWizard}
              onListen={openVoice}
              onReset={resetFilters}
            />
          </main>

          <CivicAlertsSidebar alerts={ALERTS} tierTotals={TIER_TOTALS} />
        </div>
      </div>

      {finderOpen && (
        <BenefitsFinder onClose={closeFinder} onApply={applyFromFinder} />
      )}

      {wizard && (
        <DynamicModalWizard
          key={`wizard-${wizard.service.id}`}
          service={wizard.service}
          prefill={wizard.prefill}
          onClose={closeWizard}
          onListen={openVoice}
        />
      )}

      {voiceService && (
        <ElevenLabsVoiceAssistant
          key={`voice-${voiceService.id}`}
          service={voiceService}
          onClose={closeVoice}
          onStartApplication={(service) =>
            wizard?.service.id === service.id
              ? closeVoice()
              : openWizard(service)
          }
        />
      )}
    </div>
  );
}

export default App;
