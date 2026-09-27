import { useMemo, useState } from "react";
import { Clock, ExternalLink, MapPin, RefreshCw, Siren } from "lucide-react";
import { DemoTag, SectionCard, SeverityBadge, Skeleton } from "../../components/ui/primitives";
import { buildDemoAgencyAlerts } from "../../data/demoAlerts";
import { AGENCY_STATUS_LINKS, JURISDICTION_LABEL } from "../../data/jurisdictions";
import { PROVINCES } from "../../data/provinces";
import { useI18n } from "../../i18n/i18nContext";
import { sortAlerts } from "../../lib/alertSources";
import { resolutionText } from "../../lib/alertText";
import { localizeFeedTitle } from "../../lib/feedText";
import type { AlertCategory, AlertRegion, AlertText, JurisdictionCode, RegionalAlert, RegionalAlertFeed } from "../../types/alerts";
import type { Severity } from "../../types/dashboard";
import type { LoadState } from "../../state/useCivicFeeds";

const PAGE = 6;

const CATEGORY_LABEL: Record<AlertCategory, string> = {
  "service-outage": "Service outage",
  maintenance: "Maintenance",
  delay: "Delays",
  power: "Power outage",
  road: "Road closure",
  weather: "Weather",
};

const SEVERITY_WORD: Record<Severity, { one: string; other: string }> = {
  critical: { one: "{count} critical", other: "{count} critical" },
  moderate: { one: "{count} moderate", other: "{count} moderate" },
  advisory: { one: "{count} advisory", other: "{count} advisories" },
};

const REGIONS: AlertRegion[] = ["ALL", "FED", ...PROVINCES.map((p) => p.code)];

const inRegion = (jurisdiction: JurisdictionCode, region: AlertRegion) => region === "ALL" || jurisdiction === region;

interface Shown {
  text: string;
  /** Set when the text is shown in its source language (English). */
  lang?: string;
}

function AlertCard({ alert }: { alert: RegionalAlert }) {
  const { t, locale, formatWhen, relativeTime } = useI18n();

  const field = (name: keyof AlertText): Shown | null => {
    const value = alert[name];
    if (!value) return null;
    const published = locale === "fr" ? alert.translations?.fr?.[name] : undefined;
    if (published) return { text: published };
    if (!alert.sourceText?.includes(name)) return { text: t(value) };
    if (name === "title") {
      const title = localizeFeedTitle(value, t);
      return { text: title.text, lang: title.sourceOnly && locale !== "en" ? "en" : undefined };
    }
    return { text: value, lang: locale !== "en" ? "en" : undefined };
  };

  const title = field("title");
  const detail = field("detail");
  const area = field("area");

  return (
    <li className={`ralert ralert--${alert.severity}`}>
      <div className="ralert__top">
        <span className={`jbadge jbadge--${alert.jurisdiction === "FED" ? "fed" : "prov"}`} title={`${t(JURISDICTION_LABEL[alert.jurisdiction])} · ${t(alert.agencyName)}`}>
          <span className="jbadge__code">{alert.jurisdiction}</span>
          {alert.agency}
        </span>
        <SeverityBadge severity={alert.severity} />
        <span className="ralert__category">{t(CATEGORY_LABEL[alert.category])}</span>
        {alert.demo && <DemoTag />}
      </div>
      {title && (
        <p className="ralert__title" lang={title.lang}>
          {title.text}
        </p>
      )}
      {detail && (
        <p className="ralert__detail" lang={detail.lang} data-untranslated={detail.lang ? true : undefined}>
          {detail.text}
        </p>
      )}
      <div className="ralert__meta">
        <p className="ralert__eta">
          <Clock size={14} aria-hidden="true" />
          <span>{resolutionText(alert, t, formatWhen)}</span>
        </p>
        {area && (
          <p className="ralert__area" lang={area.lang}>
            <MapPin size={13} aria-hidden="true" />
            <span>{area.text}</span>
          </p>
        )}
      </div>
      <p className="ralert__source">
        <a href={alert.sourceUrl} target="_blank" rel="noreferrer">
          {t(alert.agencyName)}
          <ExternalLink size={11} aria-hidden="true" />
        </a>
        {alert.updatedAt && <> · {t("updated {time}", { time: relativeTime(alert.updatedAt) })}</>}
      </p>
    </li>
  );
}

interface Props {
  feed: LoadState<RegionalAlertFeed> & { refresh: () => void };
  /** Region shown first; the user's province. */
  defaultRegion: AlertRegion;
  /** Adds sample agency notices while demo data is loaded. */
  demo: boolean;
}

export default function RegionalAlerts({ feed, defaultRegion, demo }: Props) {
  const { t, tp, relativeTime } = useI18n();
  const [chosen, setChosen] = useState<AlertRegion | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const [mountedAt] = useState(() => Date.now());
  const region = chosen ?? defaultRegion;

  const all = useMemo(() => sortAlerts([...(feed.data?.items ?? []), ...(demo ? buildDemoAgencyAlerts(mountedAt) : [])]), [feed.data, demo, mountedAt]);

  const regionCounts = useMemo(() => {
    const counts = Object.fromEntries(REGIONS.map((r) => [r, 0])) as Record<AlertRegion, number>;
    all.forEach((a) => {
      counts.ALL += 1;
      counts[a.jurisdiction] += 1;
    });
    return counts;
  }, [all]);

  const items = all.filter((a) => inRegion(a.jurisdiction, region));
  const severityCounts = items.reduce<Record<Severity, number>>((acc, a) => ({ ...acc, [a.severity]: acc[a.severity] + 1 }), {
    critical: 0,
    moderate: 0,
    advisory: 0,
  });
  const statusLinks = AGENCY_STATUS_LINKS.filter((l) => inRegion(l.jurisdiction, region));
  const sources = (feed.data?.sources ?? []).filter((s) => region === "ALL" || region === "FED" || s.coverage.includes(region));
  const regionName = region === "ALL" ? t("all of Canada") : t(JURISDICTION_LABEL[region]);

  const selectRegion = (next: AlertRegion) => {
    setChosen(next);
    setLimit(PAGE);
  };

  return (
    <SectionCard
      id="canada-alerts"
      className="ralerts"
      title={t("Alerts across Canada")}
      icon={<Siren size={16} />}
      actions={
        <button type="button" className="icon-btn icon-btn--sm" aria-label={t("Refresh alerts")} onClick={feed.refresh}>
          <RefreshCw size={15} />
        </button>
      }
    >
      <div className="ralerts__controls">
        <label className="region-select">
          <span className="region-select__label">{t("Filter by region")}</span>
          <select value={region} onChange={(e) => selectRegion(e.target.value as AlertRegion)}>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r === "ALL" ? t("All Canada") : r === "FED" ? t("Federal (Canada-wide)") : `${r} · ${t(JURISDICTION_LABEL[r])}`} ({regionCounts[r]})
              </option>
            ))}
          </select>
        </label>
        {items.length > 0 && (
          <p className="ralerts__summary" aria-live="polite">
            {(["critical", "moderate", "advisory"] as Severity[])
              .filter((s) => severityCounts[s] > 0)
              .map((s) => (
                <span key={s} className={`ralerts__count ralerts__count--${s}`}>
                  {tp(SEVERITY_WORD[s].one, SEVERITY_WORD[s].other, severityCounts[s])}
                </span>
              ))}
          </p>
        )}
      </div>

      {feed.status === "loading" && !demo ? (
        <Skeleton lines={4} />
      ) : items.length === 0 ? (
        <div className="muted-block">
          {feed.status === "error" && !feed.data ? t(feed.error) : t("No active alerts for {region}.", { region: regionName })}
          {region !== "ALL" && regionCounts.ALL > 0 && (
            <>
              {" "}
              <button type="button" className="link-btn" onClick={() => selectRegion("ALL")}>
                {t("See all of Canada ({count})", { count: regionCounts.ALL })}
              </button>
            </>
          )}
        </div>
      ) : (
        <ul className="ralert-list">
          {items.slice(0, limit).map((alert) => (
            <AlertCard key={alert.id} alert={alert} />
          ))}
        </ul>
      )}

      {items.length > limit && (
        <button type="button" className="link-btn" onClick={() => setLimit((l) => l + PAGE)}>
          {t("Show {count} more of {total}", { count: Math.min(PAGE, items.length - limit), total: items.length - limit })}
        </button>
      )}

      {statusLinks.length > 0 && (
        <details className="status-links">
          <summary>
            {t("Official service status pages")} <span className="chip__count">{statusLinks.length}</span>
          </summary>
          <p className="status-links__note">{t("These agencies don't publish a public status feed. Check their official pages for outages.")}</p>
          <ul>
            {statusLinks.map((link) => (
              <li key={`${link.jurisdiction}-${link.agency}`}>
                <span className={`jbadge jbadge--${link.jurisdiction === "FED" ? "fed" : "prov"}`}>
                  <span className="jbadge__code">{link.jurisdiction}</span>
                  {link.agency}
                </span>
                <span className="status-links__covers">{t(link.covers)}</span>
                <a href={link.url} target="_blank" rel="noreferrer">
                  {t("Check status")} <ExternalLink size={11} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}

      <ul className="sources" aria-label={t("Alert sources")}>
        {sources.map((s) => (
          <li key={s.id} className={`source source--${s.status}`}>
            <span className="source__dot" aria-hidden="true" />
            {t(s.label)}: {t(s.status === "live" ? "live" : "unavailable")}
          </li>
        ))}
        {demo && <li className="source">{t("Demo notices are illustrative")}</li>}
        {feed.data && <li className="source">{t("Updated {time}", { time: relativeTime(feed.data.fetchedAt) })}</li>}
      </ul>
    </SectionCard>
  );
}
