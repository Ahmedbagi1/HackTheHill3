import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import NotificationBanner from "./components/common/NotificationBanner";
import { Skeleton } from "./components/ui/primitives";
import { BANNER_NOTICE } from "./data/alerts";
import { SERVICES, SERVICES_BY_ID } from "./data/servicesData";
import { PROVINCES_BY_CODE } from "./data/provinces";
import { buildDemoAgencyAlerts } from "./data/demoAlerts";
import AlertsPage from "./features/alerts/AlertsPage";
import { useDashboardSignals } from "./features/dashboard/useDashboardSignals";
import CitizenHub from "./features/hub/CitizenHub";
import Sidebar from "./features/shell/Sidebar";
import TopBar from "./features/shell/TopBar";
import { useI18n } from "./i18n/i18nContext";
import { LanguageProvider } from "./i18n/LanguageContext";
import { buildDirectory, DEFAULT_FILTERS } from "./lib/directory";
import { CivicDataProvider } from "./state/CivicDataContext";
import { useCivicData } from "./state/civicDataStore";
import { useDisruptions, useNews } from "./state/useCivicFeeds";
import { useHashRoute, type ModuleRoute, type Route } from "./state/useHashRoute";
import { useRegionalAlerts } from "./state/useRegionalAlerts";
import { useWasteSchedule } from "./state/wasteSchedule";
import type { DashboardNotification, ProvinceCode, UserRequest } from "./types/dashboard";
import type { DirectoryFilters, TierFilter } from "./types/directory";

type CatalogService = (typeof SERVICES)[number];

// Module pages and dialogs load on demand so the hub ships a smaller initial bundle.
const HousingModule = lazy(() => import("./modules/housing/HousingModule"));
const DoctorModule = lazy(() => import("./modules/doctor/DoctorModule"));
const AutismModule = lazy(() => import("./modules/autism/AutismModule"));
const RequestDetailsDialog = lazy(() => import("./features/dashboard/RequestDetailsDialog"));
const BenefitsFinder = lazy(() => import("./components/finder/BenefitsFinder"));
const DynamicModalWizard = lazy(() => import("./components/wizard/DynamicModalWizard"));
const ElevenLabsVoiceAssistant = lazy(() => import("./components/voice/ElevenLabsVoiceAssistant"));
const NewApplicationDialog = lazy(() => import("./features/shell/NewApplicationDialog"));
const CivicChatDock = lazy(() => import("./features/ai/CivicChatDock"));

/** Anchors that live on the Disruptions & Alerts page. */
const ALERT_PAGE_ANCHORS = new Set(["waste", "disruptions", "canada-alerts", "updates"]);
const SIDEBAR_COLLAPSED_KEY = "civicos:sidebar-collapsed";

function readSidebarCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function PageFallback() {
  return (
    <main id="main" className="page" aria-busy="true">
      <Skeleton lines={4} />
    </main>
  );
}

function AppShell() {
  const [route, navigate] = useHashRoute();
  const civic = useCivicData();
  const { t, tm, locale, info } = useI18n();
  const province = PROVINCES_BY_CODE[civic.location.province];

  const [filters, setFilters] = useState<DirectoryFilters>(DEFAULT_FILTERS);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed);
  const [newAppOpen, setNewAppOpen] = useState(false);
  const [finderOpen, setFinderOpen] = useState(false);
  const [wizard, setWizard] = useState<{
    service: CatalogService;
    prefill: Record<string, unknown> | null;
    prefillSource?: "finder" | "assistant";
  } | null>(null);
  const [voiceService, setVoiceService] = useState<CatalogService | null>(null);
  const [requestDetail, setRequestDetail] = useState<UserRequest | null>(null);
  const pendingAnchor = useRef<string | null>(null);

  const waste = useWasteSchedule(province.fullCoverage ? civic.location.address : undefined);
  const origin = waste.state.status === "ready" ? { lat: waste.state.lat, lon: waste.state.lon } : null;
  const disruptions = useDisruptions(province.fullCoverage, origin);
  const news = useNews(civic.location.province, locale === "fr" ? "fr" : "en");
  const alerts = useRegionalAlerts();
  const { notifications, emergency } = useDashboardSignals(civic.requests, waste.state, disruptions.data);

  // Search indexes translations when they exist; untranslated keywords are simply skipped.
  const language = useMemo(() => ({ locale, t: tm }), [locale, tm]);
  const directory = useMemo(() => buildDirectory(filters, civic.location.province, language), [filters, civic.location.province, language]);

  const demo = civic.requests.some((r) => r.demo);
  const [demoAnchor] = useState(() => Date.now());
  const provinceAlerts = useMemo(() => {
    const items = [...(alerts.data?.items ?? []), ...(demo ? buildDemoAgencyAlerts(demoAnchor) : [])];
    return items.filter((a) => a.jurisdiction === civic.location.province);
  }, [alerts.data, demo, demoAnchor, civic.location.province]);

  // Scroll to an anchor once the page that holds it has rendered.
  useEffect(() => {
    const anchor = pendingAnchor.current;
    if (!anchor) return;
    pendingAnchor.current = null;
    window.setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }, [route]);

  const go = useCallback(
    (next: Route, anchor?: string) => {
      setMenuOpen(false);
      if (next === route) {
        if (anchor) document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      pendingAnchor.current = anchor ?? null;
      navigate(next);
    },
    [navigate, route],
  );

  const updateFilters = useCallback((patch: Partial<DirectoryFilters>) => setFilters((prev) => ({ ...prev, ...patch })), []);
  const resetFilters = useCallback(() => setFilters((prev) => ({ ...DEFAULT_FILTERS, province: prev.province })), []);

  const selectTier = (tier: TierFilter) => {
    updateFilters({ tier });
    go("dashboard", "services");
  };

  const onQuery = (query: string) => {
    const starting = filters.query.trim() === "" && query.trim() !== "";
    updateFilters({ query });
    if (route !== "dashboard") go("dashboard", "services");
    else if (starting) document.getElementById("services")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openWizard = useCallback((service: CatalogService, prefill: Record<string, unknown> | null = null) => {
    setVoiceService(null);
    setWizard({ service, prefill });
  }, []);
  const closeWizard = useCallback(() => setWizard(null), []);
  const startFromAssistant = useCallback((serviceId: string, prefill: Record<string, unknown> | null) => {
    const service = SERVICES_BY_ID[serviceId];
    if (!service) return;
    setVoiceService(null);
    setWizard({ service, prefill, prefillSource: "assistant" });
  }, []);
  const openVoice = useCallback((service: CatalogService) => setVoiceService(service), []);
  const closeVoice = useCallback(() => setVoiceService(null), []);
  const openFinder = useCallback(() => {
    setMenuOpen(false);
    setFinderOpen(true);
  }, []);
  const closeFinder = useCallback(() => setFinderOpen(false), []);
  const closeRequestDetail = useCallback(() => setRequestDetail(null), []);
  const openModule = useCallback((id: ModuleRoute) => go(id), [go]);

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
      go(ALERT_PAGE_ANCHORS.has(target.id) ? "alerts" : "dashboard", target.id);
    }
  };

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? "1" : "0");
    } catch {
      // Storage unavailable: the choice lasts for this visit.
    }
  }, [sidebarCollapsed]);

  const goHome = () => go("dashboard");

  return (
    <div className={`shell${sidebarCollapsed ? " is-collapsed" : ""}`}>
      <a className="skip-link" href="#main">
        {t("Skip to main content")}
      </a>

      <Sidebar
        route={route}
        tier={filters.tier}
        tierCounts={directory.tierCounts}
        province={directory.province}
        alertCount={provinceAlerts.length}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((c) => !c)}
        onSelectTier={selectTier}
        onSelectProvince={(code: ProvinceCode) => {
          updateFilters({ province: code, tier: "provincial" });
          go("dashboard", "services");
        }}
        onNavigate={(next) => go(next)}
        onOpenFinder={openFinder}
      />

      <div className="shell__main">
        {emergency ? (
          <NotificationBanner
            notice={{ id: emergency.id, tone: "critical", title: emergency.title, text: emergency.text }}
            actionLabel={t("Details")}
            onAction={emergency.sourceUrl ? () => window.open(emergency.sourceUrl, "_blank", "noopener") : undefined}
          />
        ) : (
          <NotificationBanner notice={BANNER_NOTICE} actionLabel={t("Check what you qualify for")} onAction={openFinder} />
        )}

        <TopBar
          query={filters.query}
          onQuery={onQuery}
          menuOpen={menuOpen}
          onToggleMenu={() => setMenuOpen((o) => !o)}
          onNewApplication={() => setNewAppOpen(true)}
          notifications={notifications}
          readIds={civic.data.readNotifications}
          onMarkRead={civic.markNotificationsRead}
          onSelectNotification={handleNotification}
        />

        {info.status === "draft" && (
          <p className="draft-notice" role="note">
            <span>{t("Draft translation")}</span>
            <span lang="en">
              Interface text is shown in {info.englishName}. Longer content still appears in English, marked EN, until fluent speakers review it.
            </span>
          </p>
        )}

        {route === "dashboard" && (
          <CitizenHub
            filters={filters}
            directory={directory}
            onChangeFilters={updateFilters}
            onResetFilters={resetFilters}
            onStartService={openWizard}
            onListen={openVoice}
            onOpenModule={openModule}
            onOpenRequest={openRequest}
            onOpenAlerts={(anchor) => go("alerts", anchor)}
            waste={waste.state}
            alertsInProvince={provinceAlerts.length}
            criticalInProvince={provinceAlerts.filter((a) => a.severity === "critical").length}
          />
        )}
        {route === "alerts" && <AlertsPage alerts={alerts} disruptions={disruptions} news={news} waste={waste} />}

        <Suspense fallback={<PageFallback />}>
          {route === "housing" && <HousingModule onBack={goHome} />}
          {route === "doctor" && <DoctorModule onBack={goHome} />}
          {route === "autism" && <AutismModule onBack={goHome} />}
        </Suspense>
      </div>

      <Suspense fallback={null}>
        {newAppOpen && (
          <NewApplicationDialog
            locationProvince={civic.location.province}
            onClose={() => setNewAppOpen(false)}
            onStartService={openWizard}
            onOpenModule={openModule}
          />
        )}

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
            prefillSource={wizard.prefillSource}
            onClose={closeWizard}
            onListen={openVoice}
            onSubmitted={civic.submitServiceRequest}
            signedIn={civic.signedIn}
          />
        )}

        {requestDetail && <RequestDetailsDialog request={requestDetail} onClose={closeRequestDetail} />}

        <CivicChatDock onStartService={startFromAssistant} onOpenModule={openModule} />

        {voiceService && (
          <ElevenLabsVoiceAssistant
            key={`voice-${voiceService.id}`}
            service={voiceService}
            onClose={closeVoice}
            onStartApplication={(service: CatalogService) => (wizard?.service.id === service.id ? closeVoice() : openWizard(service))}
          />
        )}
      </Suspense>
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <CivicDataProvider>
        <AppShell />
      </CivicDataProvider>
    </LanguageProvider>
  );
}
