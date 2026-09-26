import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import type { DashboardNotification } from "../../types/dashboard";

interface Props {
  notifications: DashboardNotification[];
  readIds: string[];
  onMarkRead: (ids: string[]) => void;
  onSelect: (notification: DashboardNotification) => void;
}

export default function NotificationsMenu({ notifications, readIds, onMarkRead, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const unread = notifications.filter((n) => !readIds.includes(n.id));

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="notifications" ref={rootRef}>
      <button
        type="button"
        className="icon-btn"
        aria-label={`Notifications${unread.length ? ` (${unread.length} unread)` : ""}`}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Bell size={20} aria-hidden="true" />
        {unread.length > 0 && <span className="icon-btn__badge">{unread.length}</span>}
      </button>

      {open && (
        <div className="popover notifications__menu" role="dialog" aria-label="Notifications">
          <div className="notifications__head">
            <strong>Notifications</strong>
            {unread.length > 0 && (
              <button type="button" className="link-btn" onClick={() => onMarkRead(unread.map((n) => n.id))}>
                <CheckCheck size={14} aria-hidden="true" /> Mark all read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="notifications__empty">You're all caught up.</p>
          ) : (
            <ul className="notifications__list">
              {notifications.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`notification${readIds.includes(n.id) ? "" : " notification--unread"}`}
                    onClick={() => {
                      onMarkRead([n.id]);
                      setOpen(false);
                      onSelect(n);
                    }}
                  >
                    <span className={`notification__dot notification__dot--${n.tone}`} aria-hidden="true" />
                    <span className="notification__body">
                      <span className="notification__title">{n.title}</span>
                      <span className="notification__detail">{n.detail}</span>
                    </span>
                    {n.actionLabel && <span className="notification__action">{n.actionLabel}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
