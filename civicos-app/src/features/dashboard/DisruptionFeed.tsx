import { useMemo, useState } from "react";
import { Droplets, ExternalLink, RefreshCw, TrafficCone, TrainFront, Zap, Activity } from "lucide-react";
import { SectionCard, SeverityBadge, Skeleton } from "../../components/ui/primitives";
import { relativeTime } from "../../lib/time";
import type { DisruptionFeed as Feed, DisruptionKind } from "../../types/dashboard";
import type { LoadState } from "../../state/useCivicFeeds";
import { useLanguage } from "../../context/LanguageContext";

const KIND_META: Record<DisruptionKind, { label: string; Icon: typeof Zap }> = {
  power: { label: "Power", Icon: Zap },
  road: { label: "Roads", Icon: TrafficCone },
  transit: { label: "Transit", Icon: TrainFront },
  water: { label: "Water", Icon: Droplets },
};

const PAGE = 6;

interface Props {
  feed: LoadState<Feed> & { refresh: () => void };
  coverage: boolean;
  nearLabel: string | null;
}

export default function DisruptionFeed({ feed, coverage, nearLabel }: Props) {
  const { t } = useLanguage();
  const [kind, setKind] = useState<DisruptionKind | "all">("all");
  const [limit, setLimit] = useState(PAGE);
  const data = feed.data;

  const counts = useMemo(() => {
    const base: Record<DisruptionKind, number> = { power: 0, road: 0, transit: 0, water: 0 };
    data?.items.forEach((i) => (base[i.kind] += 1));
    return base;
  }, [data]);

  const items = (data?.items ?? []).filter((i) => kind === "all" || i.kind === kind);
  const waterSource = data?.sources.find((s) => s.kind === "water");

  return (
    <SectionCard
      id="disruptions"
      title={t("alerts.title")}
      icon={<Activity size={16} />}
      actions={
        coverage && (
          <button type="button" className="icon-btn icon-btn--sm" aria-label="Refresh disruptions" onClick={feed.refresh}>
            <RefreshCw size={15} />
          </button>
        )
      }
    >
      {!coverage ? (
        <p className="muted-block">Live disruption feeds are connected for Ottawa. Choose Ontario to see them.</p>
      ) : feed.status === "loading" ? (
        <Skeleton lines={4} />
      ) : !data ? (
        <p className="muted-block">{feed.error}</p>
      ) : (
        <>
          {data.power && (
            <p className="power-summary">
              <Zap size={14} aria-hidden="true" />
              <span>
                Hydro Ottawa: <strong>{data.power.outages}</strong> active outage{data.power.outages === 1 ? "" : "s"},{" "}
                {data.power.customersAffected} of {data.power.customersServed.toLocaleString("en-CA")} customers affected
              </span>
            </p>
          )}

          <div className="chips" role="group" aria-label="Filter disruptions">
            <button type="button" className={`chip${kind === "all" ? " chip--active" : ""}`} aria-pressed={kind === "all"} onClick={() => setKind("all")}>
              All <span className="chip__count">{data.items.length}</span>
            </button>
            {(Object.keys(KIND_META) as DisruptionKind[]).map((k) => {
              const { label, Icon } = KIND_META[k];
              return (
                <button key={k} type="button" className={`chip${kind === k ? " chip--active" : ""}`} aria-pressed={kind === k} onClick={() => { setKind(k); setLimit(PAGE); }}>
                  <Icon size={13} aria-hidden="true" /> {label} <span className="chip__count">{counts[k]}</span>
                </button>
              );
            })}
          </div>

          {kind === "water" && waterSource ? (
            <p className="muted-block">
              {waterSource.note}{" "}
              <a href={waterSource.sourceUrl} target="_blank" rel="noreferrer">
                Check Ottawa Public Health <ExternalLink size={11} aria-hidden="true" />
              </a>
            </p>
          ) : items.length === 0 ? (
            <p className="muted-block">No active {kind === "all" ? "" : `${KIND_META[kind].label.toLowerCase()} `}disruptions reported.</p>
          ) : (
            <ul className="feed">
              {items.slice(0, limit).map((item) => {
                const { Icon } = KIND_META[item.kind];
                return (
                  <li key={item.id} className={`feed-item feed-item--${item.severity}`}>
                    <span className="feed-item__icon" aria-hidden="true">
                      <Icon size={15} />
                    </span>
                    <div className="feed-item__body">
                      <div className="feed-item__top">
                        <SeverityBadge severity={item.severity} />
                        {item.distanceKm !== undefined && <span className="feed-item__distance">{item.distanceKm} km{nearLabel ? ` from ${nearLabel}` : ""}</span>}
                      </div>
                      <p className="feed-item__title">{item.title}</p>
                      {item.detail && <p className="feed-item__detail">{item.detail}</p>}
                      <p className="feed-item__source">
                        {item.sourceUrl ? (
                          <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                            {item.source}
                          </a>
                        ) : (
                          item.source
                        )}
                        {item.updatedAt && <> · updated {relativeTime(item.updatedAt)}</>}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {items.length > limit && kind !== "water" && (
            <button type="button" className="link-btn" onClick={() => setLimit((l) => l + PAGE)}>
              Show {Math.min(PAGE, items.length - limit)} more of {items.length - limit}
            </button>
          )}

          <ul className="sources" aria-label="Feed sources">
            {data.sources.map((s) => (
              <li key={s.kind} className={`source source--${s.status}`}>
                <span className="source__dot" aria-hidden="true" />
                {s.label}: {s.status === "live" ? "live" : s.status === "no-feed" ? "no public feed" : "unavailable"}
              </li>
            ))}
            <li className="source">Updated {relativeTime(data.fetchedAt)}</li>
          </ul>
        </>
      )}
    </SectionCard>
  );
}
