import { CalendarClock, ClipboardList, Recycle, Siren, Timer } from "lucide-react";
import type { ReactNode } from "react";
import type { ModuleEntry } from "../../data/categories";
import { PROVINCES_BY_CODE } from "../../data/provinces";
import { useI18n } from "../../i18n/i18nContext";
import type { CatalogService, DirectoryResult } from "../../lib/directory";
import { useCivicData } from "../../state/civicDataStore";
import { daysUntil, type WasteState } from "../../state/wasteSchedule";
import type { UserRequest } from "../../types/dashboard";
import type { DirectoryFilters } from "../../types/directory";
import RequestTracker from "../dashboard/RequestTracker";
import ServicesSection from "./ServicesSection";

/**
 * Assumed minutes a guided, prefilled application saves compared with finding
 * the right form and filling it in by hand. Shown as an estimate, with this
 * assumption in the metric's tooltip.
 */
const MINUTES_SAVED_PER_APPLICATION = 30;

function greetingKey(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function MetricPill({ icon, children, onClick, title, tone = "neutral" }: { icon: ReactNode; children: ReactNode; onClick?: () => void; title?: string; tone?: "neutral" | "warning" | "danger" }) {
  const content = (
    <>
      <span className="metric__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="metric__text">{children}</span>
    </>
  );
  return onClick ? (
    <button type="button" className={`metric metric--${tone}`} onClick={onClick} title={title}>
      {content}
    </button>
  ) : (
    <span className={`metric metric--${tone}`} title={title}>
      {content}
    </span>
  );
}

interface Props {
  filters: DirectoryFilters;
  directory: DirectoryResult;
  onChangeFilters: (patch: Partial<DirectoryFilters>) => void;
  onResetFilters: () => void;
  onStartService: (service: CatalogService) => void;
  onListen: (service: CatalogService) => void;
  onOpenModule: (id: ModuleEntry["id"]) => void;
  onOpenRequest: (request: UserRequest) => void;
  onOpenAlerts: (anchor?: string) => void;
  waste: WasteState;
  alertsInProvince: number;
  criticalInProvince: number;
}

export default function CitizenHub({
  filters,
  directory,
  onChangeFilters,
  onResetFilters,
  onStartService,
  onListen,
  onOpenModule,
  onOpenRequest,
  onOpenAlerts,
  waste,
  alertsInProvince,
  criticalInProvince,
}: Props) {
  const { t, tp, formatDate, formatNumber } = useI18n();
  const { displayName, requests, location, withdrawRequest, seedDemo, clearDemo } = useCivicData();
  const province = PROVINCES_BY_CODE[location.province];

  const active = requests.filter((r) => !(r.currentStage === r.stages.length - 1 && r.stages[r.currentStage].state === "done"));
  const needsAction = requests.filter((r) => r.actionRequired).length;
  const hoursSaved = (requests.length * MINUTES_SAVED_PER_APPLICATION) / 60;
  const nextPickup = waste.status === "ready" ? waste.schedule.upcoming[0] : null;

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <main id="main" className="hub">
      <section className="hub-greeting" aria-labelledby="hub-title">
        <p className="hub-greeting__date">{formatDate(new Date(), "long")}</p>
        <h1 id="hub-title" className="hub-greeting__title">
          {t("{greeting}, {name}", { greeting: t(greetingKey()), name: displayName ?? t("Citizen") })}
        </h1>
        <p className="hub-greeting__lede">
          {needsAction > 0
            ? tp("{count} of your requests needs attention.", "{count} of your requests need attention.", needsAction)
            : t("Find a service, check what you qualify for, and see what's happening around you.")}
        </p>

        <div className="metrics" aria-label={t("At a glance")}>
          <MetricPill icon={<ClipboardList size={16} />} onClick={() => scrollTo("requests")} tone={needsAction ? "warning" : "neutral"}>
            {tp("{count} active application", "{count} active applications", active.length)}
          </MetricPill>
          {province.fullCoverage && (
            <MetricPill icon={<Recycle size={16} />} onClick={() => onOpenAlerts("waste")}>
              {nextPickup
                ? t("Next pickup: {day}", {
                    day: daysUntil(nextPickup.date) === 0 ? t("Today") : daysUntil(nextPickup.date) === 1 ? t("Tomorrow") : formatDate(`${nextPickup.date}T12:00:00`, "weekday"),
                  })
                : t("Set your collection day")}
            </MetricPill>
          )}
          {requests.length > 0 && (
            <MetricPill
              icon={<Timer size={16} />}
              title={t("Estimate: about {minutes} minutes saved per guided application.", { minutes: MINUTES_SAVED_PER_APPLICATION })}
            >
              {t("Est. time saved: {hours} h", { hours: formatNumber(hoursSaved, { maximumFractionDigits: 1 }) })}
            </MetricPill>
          )}
          <MetricPill icon={criticalInProvince > 0 ? <Siren size={16} /> : <CalendarClock size={16} />} onClick={() => onOpenAlerts()} tone={criticalInProvince > 0 ? "danger" : "neutral"}>
            {tp("{count} alert in {region}", "{count} alerts in {region}", alertsInProvince, { region: t(province.name) })}
          </MetricPill>
        </div>
      </section>

      <RequestTracker
        requests={requests}
        onOpen={onOpenRequest}
        onWithdraw={(r) => {
          if (r.persistence === 'supabase') {
            onOpenRequest(r);
            return;
          }
          if (window.confirm(t("Withdraw “{title}” from your dashboard?", { title: t(r.title) }))) withdrawRequest(r.id);
        }}
        onSeedDemo={seedDemo}
        onClearDemo={clearDemo}
        onBrowse={() => scrollTo("services")}
      />

      <ServicesSection
        filters={filters}
        directory={directory}
        locationProvince={location.province}
        onChange={onChangeFilters}
        onReset={onResetFilters}
        onStartService={onStartService}
        onListen={onListen}
        onOpenModule={onOpenModule}
      />
    </main>
  );
}
