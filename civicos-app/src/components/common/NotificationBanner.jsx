import { useState } from "react";
import { Megaphone, X } from "lucide-react";

const STORAGE_KEY = "civicos:dismissed-banner";

const readDismissed = () => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

/** Dismissible site-wide notice. Dismissal is remembered per browser. */
const NotificationBanner = ({ notice, actionLabel, onAction }) => {
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

  return (
    <div className={`banner banner--${notice.tone}`} role="region" aria-label="Announcement">
      <div className="banner__inner">
        <Megaphone size={18} className="banner__icon" aria-hidden="true" />
        <p className="banner__text">
          <strong>{notice.title}</strong> {notice.text}
        </p>
        {onAction && (
          <button type="button" className="banner__action" onClick={onAction}>
            {actionLabel}
          </button>
        )}
        <button type="button" className="banner__close" aria-label="Dismiss announcement" onClick={dismiss}>
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default NotificationBanner;
