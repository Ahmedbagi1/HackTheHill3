import { useState } from "react";
import { ExternalLink, Newspaper } from "lucide-react";
import { SectionCard, Skeleton } from "../../components/ui/primitives";
import { useI18n } from "../../i18n/i18nContext";
import type { LoadState, NewsFeed as Feed } from "../../state/useCivicFeeds";

interface Props {
  feed: LoadState<Feed>;
  provinceName: string;
}

/**
 * Headlines from CBC News, or Radio-Canada in French. Headlines stay in the
 * publisher's language; in Inuktitut and Anishinaabemowin they're marked as English.
 */
export default function NewsFeed({ feed, provinceName }: Props) {
  const { t, locale, relativeTime } = useI18n();
  const [scope, setScope] = useState<"provincial" | "national">("provincial");
  const items = feed.data?.[scope] ?? [];
  const headlineLang = locale === "fr" ? undefined : locale === "en" ? undefined : "en";

  return (
    <SectionCard
      id="news"
      title={t("News")}
      icon={<Newspaper size={16} />}
      actions={
        <div className="segmented" role="tablist" aria-label={t("News scope")}>
          <button type="button" role="tab" aria-selected={scope === "provincial"} className={scope === "provincial" ? "is-active" : ""} onClick={() => setScope("provincial")}>
            {provinceName}
          </button>
          <button type="button" role="tab" aria-selected={scope === "national"} className={scope === "national" ? "is-active" : ""} onClick={() => setScope("national")}>
            {t("National")}
          </button>
        </div>
      }
    >
      {feed.status === "loading" ? (
        <Skeleton lines={5} />
      ) : !feed.data ? (
        <p className="muted-block">{t(feed.error)}</p>
      ) : items.length === 0 ? (
        <p className="muted-block">{t("No headlines right now.")}</p>
      ) : (
        <ul className="news" role="tabpanel">
          {items.slice(0, 6).map((item) => (
            <li key={item.id} className="news-item">
              <a href={item.url} target="_blank" rel="noreferrer" className="news-item__link" lang={headlineLang} data-untranslated={headlineLang ? true : undefined}>
                <span className="news-item__tag">{item.category}</span>
                <span className="news-item__title">{item.title}</span>
                <span className="news-item__meta">
                  {item.source} · {relativeTime(item.publishedAt)}
                  <ExternalLink size={11} aria-hidden="true" />
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
      {feed.data && (
        <p className="fineprint">
          {locale === "fr" ? t("Headlines from Radio-Canada RSS. Opens the publisher's site.") : t("Headlines from CBC News RSS. Opens the publisher's site.")}
        </p>
      )}
    </SectionCard>
  );
}
