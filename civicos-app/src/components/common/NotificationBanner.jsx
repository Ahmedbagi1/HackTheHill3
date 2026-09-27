import { useState } from "react";
import { Megaphone, X } from "lucide-react";
import { useI18n } from "../../i18n/i18nContext";

const STORAGE_KEY = "civicos:dismissed-banner";

const readDismissed = () => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

/**
 * Dismissible site-wide notice. Dismissal is remembered per browser.
 * `notice.sourceText` keeps third-party text in its source language.
 */
const NotificationBanner = ({ notice, actionLabel, onAction }) => {
  const { t, locale } = useI18n();
  const [dismissedId, setDismissedId] = useState(readDismissed);

  if (!notice || dismissedId === notice.id) return null;

  const dismiss = () => {
    setDismissedId(notice.id);
    try {
      localStorage.setItem(STORAGE_KEY, notice.id);
    } catch {
      // Storage unavailable (private mode); dismissal lasts for this session.
    }
  };

  const text = (value) => (notice.sourceText ? value : t(value));

  return (
    <div className={`banner banner--${notice.tone}`} role="region" aria-label={t("Announcement")}>
      <div className="banner__inner">
        <Megaphone size={18} className="banner__icon" aria-hidden="true" />
        <p className="banner__text" lang={notice.sourceText && locale !== "en" ? "en" : undefined}>
          <strong>{text(notice.title)}</strong> {text(notice.text)}
        </p>
        {onAction && (
          <button type="button" className="banner__action" onClick={onAction}>
            {actionLabel}
          </button>
        )}
        <button type="button" className="banner__close" aria-label={t("Dismiss announcement")} onClick={dismiss}>
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default NotificationBanner;
