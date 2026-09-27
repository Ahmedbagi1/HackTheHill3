import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import NotificationBanner from "./components/common/NotificationBanner";
import { Skeleton } from "./components/ui/primitives";
import { BANNER_NOTICE } from "./data/alerts";
import { SERVICES, SERVICES_BY_ID } from "./data/servicesData";
import { PROVINCES_BY_CODE } from "./data/provinces";
import DashboardHeader from "./features/dashboard/DashboardHeader";
import CitizenDashboard from "./features/dashboard/CitizenDashboard";
import { useDashboardSignals } from "./features/dashboard/useDashboardSignals";
import ServiceDirectory from "./features/directory/ServiceDirectory";
import ServiceNav from "./features/navigation/ServiceNav";
import { buildDirectory, DEFAULT_FILTERS } from "./lib/directory";
import { CivicDataProvider } from "./state/CivicDataContext";
import { useCivicData } from "./state/civicDataStore";
import { useDisruptions, useNews } from "./state/useCivicFeeds";
import { useHashRoute, type ModuleRoute } from "./state/useHashRoute";
import { useRegionalAlerts } from "./state/useRegionalAlerts";
import { useWasteSchedule } from "./state/wasteSchedule";
import type { DashboardNotification, ProvinceCode, UserRequest } from "./types/dashboard";
import type { DirectoryFilters, IntentId, TierFilter } from "./types/directory";

type CatalogService = (typeof SERVICES)[number];

// Module pages and dialogs load on demand so the dashboard ships a smaller initial bundle.
const HousingModule = lazy(() => import("./modules/housing/HousingModule"));
const DoctorModule = lazy(() => import("./modules/doctor/DoctorModule"));
const AutismModule = lazy(() => import("./modules/autism/AutismModule"));
const RequestDetailsDialog = lazy(() => import("./features/dashboard/RequestDetailsDialog"));
const BenefitsFinder = lazy(() => import("./components/finder/BenefitsFinder"));
const DynamicModalWizard = lazy(() => import("./components/wizard/DynamicModalWizard"));
const ElevenLabsVoiceAssistant = lazy(() => import("./components/voice/ElevenLabsVoiceAssistant"));

function PageFallback() {
  return (
    <main id="main" className="module" aria-busy="true">
      <Skeleton lines={4} />
    </main>
  );
}

function AppShell() {
  const [route, navigate] = useHashRoute();
  const civic = useCivicData();
  const province = PROVINCES_BY_CODE[civic.location.province];

  const [filters, setFilters] = useState<DirectoryFilters>(DEFAULT_FILTERS);
  const [finderOpen, setFinderOpen] = useState(false);
  const [wizard, setWizard] = useState<{
    service: CatalogService;
    prefill: Record<string, unknown> | null;
  } | null>(null);
  const [voiceService, setVoiceService] = useState<CatalogService | null>(null);
  const [requestDetail, setRequestDetail] = useState<UserRequest | null>(null);

  const waste = useWasteSchedule(province.fullCoverage ? civic.location.address : undefined);
  const origin = waste.state.status === "ready" ? { lat: waste.state.lat, lon: waste.state.lon } : null;
  const disruptions = useDisruptions(province.fullCoverage, origin);
  const news = useNews(civic.location.province);
  const alerts = useRegionalAlerts();
  const { notifications, emergency } = useDashboardSignals(civic.requests, waste.state, disruptions.data);

  const directory = useMemo(() => buildDirectory(filters, civic.location.province), [filters, civic.location.province]);
  // Dashboard chips act as shortcuts into the whole directory, whatever filters were last used.
  const shortcutCounts = useMemo(
    () => buildDirectory({ ...DEFAULT_FILTERS, province: filters.province }, civic.location.province).intentCounts,
    [filters.province, civic.location.province],
  );

  const updateFilters = useCallback((patch: Partial<DirectoryFilters>) => setFilters((prev) => ({ ...prev, ...patch })), []);
  const resetFilters = useCallback(() => setFilters((prev) => ({ ...DEFAULT_FILTERS, province: prev.province })), []);
  const browse = useCallback(
    (patch: Partial<DirectoryFilters> = {}) => {
      updateFilters(patch);
      navigate("services");
    },
    [navigate, updateFilters],
  );

  const openWizard = useCallback((service: CatalogService, prefill: Record<string, unknown> | null = null) => {
    setVoiceService(null);
    setWizard({ service, prefill });
  }, []);
  const closeWizard = useCallback(() => setWizard(null), []);
  const openVoice = useCallback((service: CatalogService) => setVoiceService(service), []);
  const closeVoice = useCallback(() => setVoiceService(null), []);
  const openFinder = useCallback(() => setFinderOpen(true), []);
  const closeFinder = useCallback(() => setFinderOpen(false), []);
  const closeRequestDetail = useCallback(() => setRequestDetail(null), []);

  const openModule = useCallback((id: ModuleRoute) => navigate(id), [navigate]);

  const openRequest = useCallback(
    (request: UserRequest) => {
      if (request.module === "service") setRequestDetail(request);
      else openModule(request.module);
    },
    [openModule],
  );

  const handleNotification = (notification: DashboardNotification) => {
    const target = notification.target;
    if (!target) return;
    if (target.type === "request") {
      const request = civic.requests.find((r) => r.id === target.id);
      if (request) openRequest(request);
    } else if (target.type === "module") {
      if (target.id !== "service") openModule(target.id);
    } else {
      if (route !== "dashboard") navigate("dashboard");
      window.setTimeout(() => document.getElementById(target.id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    }
  };

  const goHome = () => navigate("dashboard");

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      {emergency ? (
        <NotificationBanner
          notice={{
            id: emergency.id,
            tone: "critical",
            title: emergency.title,
            text: emergency.text,
          }}
          actionLabel="Details"
          onAction={emergency.sourceUrl ? () => window.open(emergency.sourceUrl, "_blank", "noopener") : undefined}
        />
      ) : (
        <NotificationBanner notice={BANNER_NOTICE} actionLabel="Check what you qualify for" onAction={openFinder} />
      )}

      <DashboardHeader
        notifications={notifications}
        readIds={civic.data.readNotifications}
        onMarkRead={civic.markNotificationsRead}
        onSelectNotification={handleNotification}
        onHome={goHome}
      />

      <ServiceNav
        route={route}
        tier={filters.tier}
        counts={directory.tierCounts}
        province={directory.province}
        onHome={goHome}
        onSelectTier={(tier: TierFilter) => browse({ tier })}
        onSelectProvince={(code: ProvinceCode) => browse({ province: code, tier: "provincial" })}
      />

      {route === "dashboard" && (
        <CitizenDashboard
          onSearch={(query: string) => browse({ query, tier: "all", intent: "all" })}
          onSelectIntent={(intent: IntentId) => browse({ intent, tier: "all", query: "" })}
          intentCounts={shortcutCounts}
          onOpenModule={openModule}
          onOpenFinder={openFinder}
          onBrowse={() => browse({ tier: "all" })}
          onOpenRequest={openRequest}
          alerts={alerts}
          disruptions={disruptions}
          news={news}
          waste={waste}
        />
      )}
      {route === "services" && (
        <ServiceDirectory
          filters={filters}
          directory={directory}
          locationProvince={civic.location.province}
          onChange={updateFilters}
          onReset={resetFilters}
          onStartService={openWizard}
          onListen={openVoice}
          onOpenModule={openModule}
        />
      )}

      <Suspense fallback={<PageFallback />}>
        {route === "housing" && <HousingModule onBack={goHome} />}
        {route === "doctor" && <DoctorModule onBack={goHome} />}
        {route === "autism" && <AutismModule onBack={goHome} />}
      </Suspense>

      <Suspense fallback={null}>
        {finderOpen && (
          <BenefitsFinder
            onClose={closeFinder}
            onApply={(serviceId: string, prefill: Record<string, unknown>) => openWizard(SERVICES_BY_ID[serviceId], prefill)}
          />
        )}

        {wizard && (
          <DynamicModalWizard
            key={`wizard-${wizard.service.id}`}
            service={wizard.service}
            prefill={wizard.prefill}
            onClose={closeWizard}
            onListen={openVoice}
            onSubmitted={civic.submitServiceRequest}
            signedIn={civic.signedIn}
          />
        )}

        {requestDetail && <RequestDetailsDialog request={requestDetail} onClose={closeRequestDetail} />}

        {voiceService && (
          <ElevenLabsVoiceAssistant
            key={`voice-${voiceService.id}`}
            service={voiceService}
            onClose={closeVoice}
            onStartApplication={(service: CatalogService) =>
              wizard?.service.id === service.id ? closeVoice() : openWizard(service)
            }
          />
        )}
      </Suspense>
    </div>
  );
}

export default function App() {
  return (
    <CivicDataProvider>
      <AppShell />
    </CivicDataProvider>
  );
}
