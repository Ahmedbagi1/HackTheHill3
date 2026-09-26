import { useCallback, useMemo, useState } from "react";
import Header from "./components/common/Header";
import NotificationBanner from "./components/common/NotificationBanner";
import SearchBar from "./components/common/SearchBar";
import TierTabs from "./components/common/TierTabs";
import CivicAlertsSidebar from "./components/dashboard/CivicAlertsSidebar";
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
  const [wizardService, setWizardService] = useState(null);
  const [voiceService, setVoiceService] = useState(null);

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

  const openWizard = useCallback((service) => {
    setVoiceService(null);
    setWizardService(service);
  }, []);
  const closeWizard = useCallback(() => setWizardService(null), []);
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
        actionLabel="Estimate yours"
        onAction={() => openWizard(SERVICES_BY_ID[BANNER_NOTICE.serviceId])}
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

      {wizardService && (
        <DynamicModalWizard
          key={`wizard-${wizardService.id}`}
          service={wizardService}
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
            wizardService?.id === service.id
              ? closeVoice()
              : openWizard(service)
          }
        />
      )}
    </div>
  );
}

export default App;
