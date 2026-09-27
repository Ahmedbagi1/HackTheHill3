import { useMemo, useRef, useState } from "react";
import { ArrowRight, Search, Sparkles, X } from "lucide-react";
import TierBadge from "../../components/common/TierBadge";
import { useDialogBehavior } from "../../hooks/useDialogBehavior";
import { useI18n } from "../../i18n/i18nContext";
import { buildDirectory, DEFAULT_FILTERS, type CatalogService, type DirectoryItem } from "../../lib/directory";
import type { ModuleRoute } from "../../state/useHashRoute";
import type { ProvinceCode } from "../../types/dashboard";

interface Props {
  locationProvince: ProvinceCode;
  onClose: () => void;
  onStartService: (service: CatalogService) => void;
  onOpenModule: (route: ModuleRoute) => void;
}

type Startable = Extract<DirectoryItem, { kind: "service" | "module" }>;

/** Keyboard-first picker: type to filter, arrow keys to move, Enter to start. */
export default function NewApplicationDialog({ locationProvince, onClose, onStartService, onOpenModule }: Props) {
  useDialogBehavior(onClose);
  const { t, tm, locale } = useI18n();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const items = useMemo(
    () =>
      buildDirectory({ ...DEFAULT_FILTERS, query }, locationProvince, { locale, t: tm }).items.filter(
        (item): item is Startable => item.kind === "service" || item.kind === "module",
      ),
    [query, locationProvince, locale, tm],
  );
  const current = Math.min(active, Math.max(0, items.length - 1));

  const start = (item: Startable) => {
    onClose();
    if (item.kind === "service") onStartService(item.service);
    else onOpenModule(item.module.id);
  };

  const move = (delta: number) => {
    if (items.length === 0) return;
    const next = (current + delta + items.length) % items.length;
    setActive(next);
    listRef.current?.querySelectorAll("li")[next]?.scrollIntoView({ block: "nearest" });
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal palette" role="dialog" aria-modal="true" aria-labelledby="palette-title">
        <div className="palette__header">
          <h2 id="palette-title" className="palette__title">
            {t("Start a new application")}
          </h2>
          <button type="button" className="icon-btn" aria-label={t("Close")} onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="palette__search">
          <Search size={17} aria-hidden="true" />
          <input
            autoFocus
            type="search"
            aria-label={t("Search services or describe your situation")}
            aria-controls="palette-list"
            aria-activedescendant={items[current] ? `palette-${items[current].id}` : undefined}
            placeholder={t("Search services or a task…")}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                move(1);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                move(-1);
              } else if (e.key === "Enter" && items[current]) {
                e.preventDefault();
                start(items[current]);
              }
            }}
          />
        </div>
        {items.length === 0 ? (
          <p className="palette__empty">{t("No services match these filters")}</p>
        ) : (
          <ul className="palette__list" id="palette-list" role="listbox" ref={listRef} aria-label={t("Services")}>
            {items.map((item, index) => {
              const Icon = item.kind === "service" ? item.service.icon : Sparkles;
              const title = item.kind === "service" ? item.service.title : item.module.title;
              const agency = item.kind === "service" ? item.service.agency : t("Guided program");
              return (
                <li key={item.id} id={`palette-${item.id}`} role="option" aria-selected={index === current}>
                  <button
                    type="button"
                    tabIndex={-1}
                    className={`palette__item${index === current ? " is-active" : ""}`}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => start(item)}
                  >
                    <span className={`palette__icon palette__icon--${item.tier.toLowerCase()}`} aria-hidden="true">
                      <Icon size={17} />
                    </span>
                    <span className="palette__text">
                      <span className="palette__name">{t(title)}</span>
                      <span className="palette__agency">{t(agency)}</span>
                    </span>
                    <TierBadge tier={item.tier} />
                    <ArrowRight size={15} className="palette__go" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="palette__hint">{t("Use ↑ ↓ to move and Enter to start.")}</p>
      </div>
    </div>
  );
}
