import { useMemo, useState } from "react";
import { ArrowRight, Baby, HeartPulse, House, LayoutGrid, Search, Sparkles, Volume2, X } from "lucide-react";
import { useDialogBehavior } from "../../hooks/useDialogBehavior";
import { SERVICES } from "../../data/servicesData";
import { CATEGORIES, MODULES, SERVICE_CATEGORY, type ModuleEntry } from "../../data/categories";
import { PROVINCES_BY_CODE } from "../../data/provinces";
import { useCivicData } from "../../state/civicDataStore";
import type { ServiceCategoryId } from "../../types/dashboard";

type CatalogService = (typeof SERVICES)[number];

const MODULE_ICONS = { housing: House, doctor: HeartPulse, autism: Baby } as const;

interface Props {
  onClose: () => void;
  onStartService: (service: CatalogService) => void;
  onListen: (service: CatalogService) => void;
  onOpenModule: (id: ModuleEntry["id"]) => void;
}

const matches = (text: string, query: string) => text.toLowerCase().includes(query);

export default function ServiceHub({ onClose, onStartService, onListen, onOpenModule }: Props) {
  useDialogBehavior(onClose);
  const { location } = useCivicData();
  const province = PROVINCES_BY_CODE[location.province];
  const [active, setActive] = useState<ServiceCategoryId | "all">("all");
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const available = (tier: string) => province.fullCoverage || tier === "Federal";

  const { services, modules, counts } = useMemo(() => {
    const serviceHits = SERVICES.filter(
      (s) => !q || matches(`${s.title} ${s.summary} ${s.agency} ${s.keywords.join(" ")}`, q),
    );
    const moduleHits = MODULES.filter((m) => !q || matches(`${m.title} ${m.summary} ${m.keywords.join(" ")}`, q));
    const tally = Object.fromEntries(CATEGORIES.map((c) => [c.id, 0])) as Record<ServiceCategoryId, number>;
    serviceHits.forEach((s) => (tally[SERVICE_CATEGORY[s.id]] += 1));
    moduleHits.forEach((m) => (tally[m.category] += 1));
    return {
      services: serviceHits.filter((s) => active === "all" || SERVICE_CATEGORY[s.id] === active),
      modules: moduleHits.filter((m) => active === "all" || m.category === active),
      counts: tally,
    };
  }, [q, active]);

  const grouped = CATEGORIES.map((category) => ({
    category,
    modules: modules.filter((m) => m.category === category.id),
    services: services.filter((s) => SERVICE_CATEGORY[s.id] === category.id),
  })).filter((g) => g.modules.length || g.services.length);

  const total = services.length + modules.length;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal hub" role="dialog" aria-modal="true" aria-labelledby="hub-title">
        <div className="hub__header">
          <div>
            <p className="modal__eyebrow">
              <LayoutGrid size={13} aria-hidden="true" /> Service directory
            </p>
            <h2 id="hub-title" className="modal__title">
              Every service, organised
            </h2>
          </div>
          <button type="button" className="icon-btn" aria-label="Close directory" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="hub__search">
          <Search size={16} aria-hidden="true" />
          <label htmlFor="hub-search" className="sr-only">
            Filter services
          </label>
          <input
            id="hub-search"
            type="search"
            placeholder="Filter services…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>

        {!province.fullCoverage && (
          <p className="hub__coverage">
            Showing federal services for {province.name}. Ontario and City of Ottawa services are listed for reference.
          </p>
        )}

        <div className="hub__body">
          <nav className="hub__nav" aria-label="Categories">
            <button type="button" className={`hub__cat${active === "all" ? " is-active" : ""}`} onClick={() => setActive("all")}>
              All categories <span>{Object.values(counts).reduce((a, b) => a + b, 0)}</span>
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`hub__cat${active === c.id ? " is-active" : ""}`}
                onClick={() => setActive(c.id)}
                disabled={counts[c.id] === 0}
              >
                {c.label} <span>{counts[c.id]}</span>
              </button>
            ))}
          </nav>

          <div className="hub__results" aria-live="polite">
            {total === 0 && <p className="hub__empty">No services match “{query}”.</p>}
            {grouped.map(({ category, modules: mods, services: svcs }) => (
              <section key={category.id} className="hub__group" aria-labelledby={`hub-${category.id}`}>
                <h3 id={`hub-${category.id}`} className="hub__group-title">
                  {category.label}
                  <span>{category.description}</span>
                </h3>
                <ul className="hub__list">
                  {mods.map((m) => {
                    const Icon = MODULE_ICONS[m.id];
                    const enabled = available(m.tier);
                    return (
                      <li key={m.id} className="hub-item hub-item--module">
                        <span className="hub-item__icon" aria-hidden="true">
                          <Icon size={18} />
                        </span>
                        <div className="hub-item__body">
                          <p className="hub-item__title">
                            {m.title} <span className="hub-item__flag"><Sparkles size={11} aria-hidden="true" /> Guided</span>
                          </p>
                          <p className="hub-item__summary">{m.summary}</p>
                        </div>
                        <button type="button" className="btn btn--primary btn--sm" disabled={!enabled} onClick={() => onOpenModule(m.id)}>
                          Open <ArrowRight size={14} aria-hidden="true" />
                        </button>
                      </li>
                    );
                  })}
                  {svcs.map((s) => {
                    const Icon = s.icon;
                    const enabled = available(s.tier);
                    return (
                      <li key={s.id} className={`hub-item${enabled ? "" : " is-unavailable"}`}>
                        <span className={`hub-item__icon hub-item__icon--${s.tier.toLowerCase()}`} aria-hidden="true">
                          <Icon size={18} />
                        </span>
                        <div className="hub-item__body">
                          <p className="hub-item__title">
                            {s.title} <span className={`badge badge--${s.tier.toLowerCase()}`}>{s.tier}</span>
                          </p>
                          <p className="hub-item__summary">{s.summary}</p>
                        </div>
                        <div className="hub-item__actions">
                          <button type="button" className="icon-btn" aria-label={`Explain ${s.title}`} onClick={() => onListen(s)}>
                            <Volume2 size={16} />
                          </button>
                          <button type="button" className="btn btn--secondary btn--sm" disabled={!enabled} onClick={() => onStartService(s)}>
                            Start
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
