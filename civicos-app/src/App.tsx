import { lazy, Suspense, useCallback, useState } from "react";
import NotificationBanner from "./components/common/NotificationBanner";
import { Skeleton } from "./components/ui/primitives";
import { BANNER_NOTICE } from "./data/alerts";
import { SERVICES, SERVICES_BY_ID } from "./data/servicesData";
import { PROVINCES_BY_CODE } from "./data/provinces";
import DashboardHeader from "./features/dashboard/DashboardHeader";
import CitizenDashboard from "./features/dashboard/CitizenDashboard";
import { useDashboardSignals } from "./features/dashboard/useDashboardSignals";
import { CivicDataProvider } from "./state/CivicDataContext";
import { useCivicData } from "./state/civicDataStore";
import { useDisruptions, useNews } from "./state/useCivicFeeds";
import { useHashRoute, type Route } from "./state/useHashRoute";
import { useWasteSchedule } from "./state/wasteSchedule";
import type { DashboardNotification, UserRequest } from "./types/dashboard";

type CatalogService = (typeof SERVICES)[number];
type ModuleRoute = Exclude<Route, "dashboard">;

// Module pages and dialogs load on demand so the dashboard ships a smaller initial bundle.
const HousingModule = lazy(() => import("./modules/housing/HousingModule"));
const DoctorModule = lazy(() => import("./modules/doctor/DoctorModule"));
const AutismModule = lazy(() => import("./modules/autism/AutismModule"));
const ServiceHub = lazy(() => import("./features/dashboard/ServiceHub"));
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

  const [hubOpen, setHubOpen] = useState(false);
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
  const { notifications, emergency } = useDashboardSignals(civic.requests, waste.state, disruptions.data);

  const openWizard = useCallback((service: CatalogService, prefill: Record<string, unknown> | null = null) => {
    setVoiceService(null);
    setHubOpen(false);
    setWizard({ service, prefill });
  }, []);
  const closeWizard = useCallback(() => setWizard(null), []);
  const openVoice = useCallback((service: CatalogService) => setVoiceService(service), []);
  const closeVoice = useCallback(() => setVoiceService(null), []);
  const closeHub = useCallback(() => setHubOpen(false), []);
  const openFinder = useCallback(() => setFinderOpen(true), []);
  const closeFinder = useCallback(() => setFinderOpen(false), []);
  const closeRequestDetail = useCallback(() => setRequestDetail(null), []);

  const openModule = useCallback(
    (id: ModuleRoute) => {
      setHubOpen(false);
      navigate(id);
    },
    [navigate],
  );

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
        onOpenHub={() => setHubOpen(true)}
        onHome={goHome}
      />

      {route === "dashboard" && (
        <CitizenDashboard
          onStartService={openWizard}
          onListen={openVoice}
          onOpenModule={openModule}
          onOpenFinder={openFinder}
          onOpenHub={() => setHubOpen(true)}
          onOpenRequest={openRequest}
          disruptions={disruptions}
          news={news}
          waste={waste}
        />
      )}

      <Suspense fallback={<PageFallback />}>
        {route === "housing" && <HousingModule onBack={goHome} />}
        {route === "doctor" && <DoctorModule onBack={goHome} />}
        {route === "autism" && <AutismModule onBack={goHome} />}
      </Suspense>

      <Suspense fallback={null}>
        {hubOpen && <ServiceHub onClose={closeHub} onStartService={openWizard} onListen={openVoice} onOpenModule={openModule} />}

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
