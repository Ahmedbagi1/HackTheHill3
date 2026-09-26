import { useMemo, useState } from "react";
import { Clock, ExternalLink, MapPin, RefreshCw, Siren } from "lucide-react";
import { DemoTag, SectionCard, SeverityBadge, Skeleton } from "../../components/ui/primitives";
import { buildDemoAgencyAlerts } from "../../data/demoAlerts";
import { AGENCY_STATUS_LINKS, JURISDICTION_LABEL } from "../../data/jurisdictions";
import { PROVINCES } from "../../data/provinces";
import { sortAlerts } from "../../lib/alertSources";
import { resolutionText } from "../../lib/alertText";
import { relativeTime } from "../../lib/time";
import type { AlertCategory, AlertRegion, JurisdictionCode, RegionalAlert, RegionalAlertFeed } from "../../types/alerts";
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

const REGIONS: AlertRegion[] = ["ALL", "FED", ...PROVINCES.map((p) => p.code)];

const regionName = (region: AlertRegion) => (region === "ALL" ? "all of Canada" : JURISDICTION_LABEL[region]);

const inRegion = (jurisdiction: JurisdictionCode, region: AlertRegion) => region === "ALL" || jurisdiction === region;

function AlertCard({ alert }: { alert: RegionalAlert }) {
  return (
    <li className={`ralert ralert--${alert.severity}`}>
      <div className="ralert__top">
        <span
          className={`jbadge jbadge--${alert.jurisdiction === "FED" ? "fed" : "prov"}`}
          title={`${JURISDICTION_LABEL[alert.jurisdiction]} · ${alert.agencyName}`}
        >
          <span className="jbadge__code">{alert.jurisdiction}</span>
          {alert.agency}
        </span>
        <SeverityBadge severity={alert.severity} />
        <span className="ralert__category">{CATEGORY_LABEL[alert.category]}</span>
        {alert.demo && <DemoTag />}
      </div>
      <p className="ralert__title">{alert.title}</p>
      {alert.detail && <p className="ralert__detail">{alert.detail}</p>}
      <div className="ralert__meta">
        <p className="ralert__eta">
          <Clock size={14} aria-hidden="true" />
          <span>{resolutionText(alert)}</span>
        </p>
        {alert.area && (
          <p className="ralert__area">
            <MapPin size={13} aria-hidden="true" />
            <span>{alert.area}</span>
          </p>
        )}
      </div>
      <p className="ralert__source">
        <a href={alert.sourceUrl} target="_blank" rel="noreferrer">
          {alert.agencyName}
          <ExternalLink size={11} aria-hidden="true" />
        </a>
        {alert.updatedAt && <> · updated {relativeTime(alert.updatedAt)}</>}
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
  const [chosen, setChosen] = useState<AlertRegion | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const [mountedAt] = useState(() => Date.now());
  const region = chosen ?? defaultRegion;

  const all = useMemo(
    () => sortAlerts([...(feed.data?.items ?? []), ...(demo ? buildDemoAgencyAlerts(mountedAt) : [])]),
    [feed.data, demo, mountedAt],
  );

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

  const selectRegion = (next: AlertRegion) => {
    setChosen(next);
    setLimit(PAGE);
  };

  return (
    <SectionCard
      id="canada-alerts"
      className="ralerts"
      title="Alerts across Canada"
      icon={<Siren size={16} />}
      actions={
        <button type="button" className="icon-btn icon-btn--sm" aria-label="Refresh alerts" onClick={feed.refresh}>
          <RefreshCw size={15} />
        </button>
      }
    >
      <div className="ralerts__controls">
        <label className="region-select">
          <span className="region-select__label">Filter by region</span>
          <select value={region} onChange={(e) => selectRegion(e.target.value as AlertRegion)}>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r === "ALL" ? "All Canada" : r === "FED" ? "Federal (Canada-wide)" : `${r} · ${JURISDICTION_LABEL[r]}`} (
                {regionCounts[r]})
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
                  <strong>{severityCounts[s]}</strong> {s}
                </span>
              ))}
          </p>
        )}
      </div>

      {feed.status === "loading" && !demo ? (
        <Skeleton lines={4} />
      ) : items.length === 0 ? (
        <div className="muted-block">
          {feed.status === "error" && !feed.data ? feed.error : `No active alerts for ${regionName(region)}.`}
          {region !== "ALL" && regionCounts.ALL > 0 && (
            <>
              {" "}
              <button type="button" className="link-btn" onClick={() => selectRegion("ALL")}>
                See all of Canada ({regionCounts.ALL})
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
          Show {Math.min(PAGE, items.length - limit)} more of {items.length - limit}
        </button>
      )}

      {statusLinks.length > 0 && (
        <details className="status-links">
          <summary>
            Official service status pages <span className="chip__count">{statusLinks.length}</span>
          </summary>
          <p className="status-links__note">
            These agencies don't publish a public status feed. Check their official pages for outages.
          </p>
          <ul>
            {statusLinks.map((link) => (
              <li key={`${link.jurisdiction}-${link.agency}`}>
                <span className={`jbadge jbadge--${link.jurisdiction === "FED" ? "fed" : "prov"}`}>
                  <span className="jbadge__code">{link.jurisdiction}</span>
                  {link.agency}
                </span>
                <span className="status-links__covers">{link.covers}</span>
                <a href={link.url} target="_blank" rel="noreferrer">
                  Check status <ExternalLink size={11} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}

      <ul className="sources" aria-label="Alert sources">
        {sources.map((s) => (
          <li key={s.id} className={`source source--${s.status}`}>
            <span className="source__dot" aria-hidden="true" />
            {s.label}: {s.status === "live" ? "live" : "unavailable"}
          </li>
        ))}
        {demo && <li className="source">Demo notices are illustrative</li>}
        {feed.data && <li className="source">Updated {relativeTime(feed.data.fetchedAt)}</li>}
      </ul>
    </SectionCard>
  );
}
