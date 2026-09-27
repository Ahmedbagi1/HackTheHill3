import { Megaphone } from "lucide-react";
import { SectionCard } from "../../components/ui/primitives";
import { ALERTS } from "../../data/alerts";
import { PROVINCES_BY_CODE } from "../../data/provinces";
import { useI18n } from "../../i18n/i18nContext";
import Tx from "../../i18n/Tx";
import { useCivicData } from "../../state/civicDataStore";
import type { LoadState, NewsFeed as NewsData } from "../../state/useCivicFeeds";
import type { WasteState } from "../../state/wasteSchedule";
import type { RegionalAlertFeed } from "../../types/alerts";
import type { DisruptionFeed as DisruptionData, WasteRotation } from "../../types/dashboard";
import DisruptionFeed from "../dashboard/DisruptionFeed";
import NewsFeed from "../dashboard/NewsFeed";
import WasteRail from "../dashboard/WasteRail";
import RegionalAlerts from "./RegionalAlerts";

interface Props {
  alerts: LoadState<RegionalAlertFeed> & { refresh: () => void };
  disruptions: LoadState<DisruptionData> & { refresh: () => void };
  news: LoadState<NewsData>;
  waste: { state: WasteState; rotation: WasteRotation | null; setRotation: (r: WasteRotation | null) => void };
}

/** Disruptions & Alerts: pan-Canadian alerts, local Ottawa services and headlines. */
export default function AlertsPage({ alerts, disruptions, news, waste }: Props) {
  const { t } = useI18n();
  const { requests, location, setLocation } = useCivicData();
  const province = PROVINCES_BY_CODE[location.province];
  const demo = requests.some((r) => r.demo);
  const nearLabel = waste.state.status === "ready" ? t("your address") : null;

  return (
    <main id="main" className="page">
      <header className="page-head">
        <h1 className="page-head__title">{t("Disruptions & Alerts")}</h1>
        <p className="page-head__lede">{t("Outages, closures and weather alerts across Canada, plus local services where you live.")}</p>
      </header>

      <div className="alerts-layout">
        <div className="alerts-layout__main">
          <RegionalAlerts key={location.province} feed={alerts} defaultRegion={location.province} demo={demo} />
          {province.fullCoverage && <DisruptionFeed feed={disruptions} coverage nearLabel={nearLabel} />}
        </div>
        <aside className="alerts-layout__rail" aria-label={t("Local services")}>
          <WasteRail
            coverage={province.fullCoverage}
            address={location.address}
            onSaveAddress={(address) => setLocation({ address })}
            state={waste.state}
            rotation={waste.rotation}
            onSetRotation={waste.setRotation}
          />
          <SectionCard id="updates" title={t("Program updates")} icon={<Megaphone size={16} />}>
            <ul className="updates">
              {ALERTS.map((alert) => (
                <li key={alert.id} className="update">
                  <span className={`alert__dot alert__dot--${alert.tone}`} aria-hidden="true" />
                  <p>
                    <strong>{t(alert.tier)}</strong> <Tx text={alert.text} />
                  </p>
                </li>
              ))}
            </ul>
          </SectionCard>
          <NewsFeed feed={news} provinceName={t(province.name)} />
        </aside>
      </div>
    </main>
  );
}
