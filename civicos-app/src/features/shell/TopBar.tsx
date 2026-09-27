import { useEffect, useRef, useState } from "react";
import { Menu, Plus, Search, Sparkles, X } from "lucide-react";
import { useI18n } from "../../i18n/i18nContext";
import type { DashboardNotification } from "../../types/dashboard";
import NotificationsMenu from "../dashboard/NotificationsMenu";
import ProvinceSelector from "../dashboard/ProvinceSelector";
import LanguagePicker from "./LanguagePicker";

const SUGGESTIONS = ["Lost wallet", "Starting a business", "Having a baby", "Moving", "Lost my job"];

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

interface Props {
  query: string;
  onQuery: (query: string) => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onNewApplication: () => void;
  notifications: DashboardNotification[];
  readIds: string[];
  onMarkRead: (ids: string[]) => void;
  onSelectNotification: (notification: DashboardNotification) => void;
}

export default function TopBar({
  query,
  onQuery,
  menuOpen,
  onToggleMenu,
  onNewApplication,
  notifications,
  readIds,
  onMarkRead,
  onSelectNotification,
}: Props) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  // ⌘K / Ctrl+K focuses the command search from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const showSuggestions = focused && query.trim() === "";

  return (
    <header className="utilbar">
      <button type="button" className="icon-btn utilbar__menu" aria-label={t("Open menu")} aria-controls="sidebar" aria-expanded={menuOpen} onClick={onToggleMenu}>
        <Menu size={20} />
      </button>

      <div className="cmdk" role="search">
        <Search size={17} className="cmdk__icon" aria-hidden="true" />
        <label htmlFor="service-search" className="sr-only">
          {t("Search services or describe your situation")}
        </label>
        <input
          ref={inputRef}
          id="service-search"
          type="search"
          className="cmdk__input"
          placeholder={t("Search services or a task…")}
          value={query}
          autoComplete="off"
          aria-describedby="cmdk-shortcut"
          onChange={(e) => onQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              if (query) onQuery("");
              else inputRef.current?.blur();
            }
          }}
        />
        {query ? (
          <button type="button" className="cmdk__clear" aria-label={t("Clear search")} onClick={() => onQuery("")}>
            <X size={15} />
          </button>
        ) : (
          <kbd className="cmdk__kbd" id="cmdk-shortcut" aria-label={isMac ? "Command K" : "Control K"}>
            {isMac ? "⌘K" : "Ctrl K"}
          </kbd>
        )}
        {showSuggestions && (
          <div className="cmdk__menu" role="listbox" aria-label={t("Try a situation:")}>
            <p className="cmdk__menu-label">
              <Sparkles size={13} aria-hidden="true" /> {t("Try a situation:")}
            </p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                role="option"
                aria-selected={false}
                className="cmdk__option"
                // mousedown fires before the input blurs and hides the menu.
                onMouseDown={(e) => {
                  e.preventDefault();
                  onQuery(t(s));
                }}
              >
                {t(s)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="utilbar__actions">
        <ProvinceSelector />
        <LanguagePicker variant="pill" />
        <NotificationsMenu notifications={notifications} readIds={readIds} onMarkRead={onMarkRead} onSelect={onSelectNotification} />
        <button type="button" className="btn btn--primary utilbar__new" onClick={onNewApplication}>
          <Plus size={16} aria-hidden="true" />
          <span>{t("New application")}</span>
        </button>
      </div>
    </header>
  );
}
