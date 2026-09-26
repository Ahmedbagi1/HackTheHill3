import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Bell,
  Car,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Clock,
  IdCard,
  Landmark,
  Pencil,
  Plane,
  Recycle,
  Search,
  SearchX,
  ShieldCheck,
  User,
  Wallet,
  X,
  Zap,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/* Data                                                                       */
/* -------------------------------------------------------------------------- */

const LEVELS = ["All", "Municipal", "Provincial", "Federal"];

const SERVICES = [
  {
    id: "lost-wallet",
    title: "Lost wallet",
    summary: "Report a lost wallet and request replacement documents.",
    level: "Municipal",
    time: "10 mins",
    icon: Wallet,
    keywords: ["lost", "stolen", "police report", "cards", "id"],
  },
  {
    id: "drivers-license",
    title: "Renew Driver's License",
    summary: "Renew your driver's license online before it expires.",
    level: "Provincial",
    time: "2 weeks",
    icon: IdCard,
    keywords: ["license", "licence", "driving", "id", "renewal"],
  },
  {
    id: "trash-pickup",
    title: "Trash pickup schedule",
    summary: "Check garbage, recycling and green bin collection days.",
    level: "Municipal",
    time: "5 mins",
    icon: Recycle,
    keywords: ["garbage", "recycling", "green bin", "waste", "collection"],
  },
  {
    id: "passport",
    title: "Passport renewal",
    summary: "Renew your passport for travel outside the country.",
    level: "Federal",
    time: "3 weeks",
    icon: Plane,
    keywords: ["travel", "passport", "citizenship", "renewal"],
  },
  {
    id: "utility-bill",
    title: "Utility bill payment",
    summary: "Pay hydro, water and gas bills in one place.",
    level: "Provincial",
    time: "2 days",
    icon: Zap,
    keywords: ["hydro", "electricity", "water", "gas", "bill", "pay"],
  },
  {
    id: "vehicle-registration",
    title: "Vehicle registration",
    summary: "Register a new or used vehicle and get your plates.",
    level: "Municipal",
    time: "1 week",
    icon: Car,
    keywords: ["car", "plates", "ownership", "sticker", "registration"],
  },
];

const ALERTS = [
  {
    id: "sweeping",
    tone: "warning",
    text: "Spring street sweeping schedule has been updated.",
  },
  {
    id: "passport-delays",
    tone: "danger",
    text: "Passport processing delays: expect 2-3 weeks.",
  },
  {
    id: "green-bin",
    tone: "success",
    text: "Green bin and organic pickup scheduled for tomorrow.",
  },
];

const LEVEL_TOTALS = LEVELS.reduce((acc, level) => {
  acc[level] =
    level === "All"
      ? SERVICES.length
      : SERVICES.filter((s) => s.level === level).length;
  return acc;
}, {});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[\d\s()+-]{7,}$/;
const POSTAL_RE = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;

const STEPS = [
  {
    id: "identity",
    label: "Identity",
    title: "Identity & eligibility",
    description: "Tell us who is applying so we can verify eligibility.",
    fields: [
      {
        name: "fullName",
        label: "Full name",
        type: "text",
        autoComplete: "name",
        placeholder: "Jane Doe",
        full: true,
      },
      {
        name: "email",
        label: "Email address",
        type: "email",
        autoComplete: "email",
        placeholder: "jane@example.com",
      },
      {
        name: "phone",
        label: "Phone number",
        type: "tel",
        autoComplete: "tel",
        placeholder: "(613) 555-0123",
        optional: true,
      },
    ],
  },
  {
    id: "address",
    label: "Address",
    title: "Residential address",
    description: "Where should correspondence about this application go?",
    fields: [
      {
        name: "address",
        label: "Street address",
        type: "text",
        autoComplete: "street-address",
        placeholder: "123 Wellington St",
        full: true,
      },
      {
        name: "city",
        label: "City",
        type: "text",
        autoComplete: "address-level2",
        placeholder: "Ottawa",
      },
      {
        name: "postalCode",
        label: "Postal code",
        type: "text",
        autoComplete: "postal-code",
        placeholder: "K1A 0A6",
      },
    ],
  },
  {
    id: "review",
    label: "Review",
    title: "Review & submit",
    description: "Confirm your details before submitting the application.",
    fields: [],
  },
];

const EMPTY_FORM = {
  fullName: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  postalCode: "",
  consent: false,
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const normalize = (value) => value.toLowerCase().trim();

const matchesQuery = (service, query) => {
  if (!query) return true;
  return [service.title, service.summary, service.level, ...service.keywords]
    .map(normalize)
    .some((text) => text.includes(query));
};

const validateStep = (stepIndex, form) => {
  const errors = {};

  if (stepIndex === 0) {
    if (!form.fullName.trim()) errors.fullName = "Full name is required.";
    if (!form.email.trim()) errors.email = "Email address is required.";
    else if (!EMAIL_RE.test(form.email.trim()))
      errors.email = "Enter a valid email address.";
    if (form.phone.trim() && !PHONE_RE.test(form.phone.trim()))
      errors.phone = "Enter a valid phone number.";
  }

  if (stepIndex === 1) {
    if (!form.address.trim()) errors.address = "Street address is required.";
    if (!form.city.trim()) errors.city = "City is required.";
    if (!form.postalCode.trim()) errors.postalCode = "Postal code is required.";
    else if (!POSTAL_RE.test(form.postalCode.trim()))
      errors.postalCode = "Use the format A1A 1A1.";
  }

  if (stepIndex === 2 && !form.consent) {
    errors.consent = "Please confirm the information is accurate.";
  }

  return errors;
};

/* -------------------------------------------------------------------------- */
/* Components                                                                 */
/* -------------------------------------------------------------------------- */

const Header = () => (
  <header className="topbar">
    <div className="topbar__inner">
      <div className="brand">
        <span className="brand__mark" aria-hidden="true">
          <Landmark size={18} />
        </span>
        CivicOS
        <span className="brand__tag">Civic services dashboard</span>
      </div>
      <div className="topbar__actions">
        <button
          type="button"
          className="icon-btn"
          aria-label={`Notifications (${ALERTS.length} new)`}
        >
          <Bell size={20} />
          <span className="icon-btn__badge">{ALERTS.length}</span>
        </button>
        <button type="button" className="avatar" aria-label="Profile">
          <User size={18} />
        </button>
      </div>
    </div>
  </header>
);

const SearchBar = ({ value, onChange }) => (
  <div className="search">
    <Search className="search__icon" size={18} aria-hidden="true" />
    <label htmlFor="service-search" className="sr-only">
      Search services
    </label>
    <input
      id="service-search"
      type="search"
      className="search__input"
      placeholder="Search services, e.g. passport, license, recycling…"
      value={value}
      autoComplete="off"
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Escape") onChange("");
      }}
    />
    {value && (
      <button
        type="button"
        className="search__clear"
        aria-label="Clear search"
        onClick={() => onChange("")}
      >
        <X size={16} />
      </button>
    )}
  </div>
);

const CategoryTabs = ({ active, counts, onChange }) => {
  const handleKeyDown = (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const delta = e.key === "ArrowRight" ? 1 : -1;
    const next =
      LEVELS[(LEVELS.indexOf(active) + delta + LEVELS.length) % LEVELS.length];
    onChange(next);
    e.currentTarget.querySelector(`[data-level="${next}"]`)?.focus();
  };

  return (
    <div
      className="tabs"
      role="tablist"
      aria-label="Filter by government level"
      onKeyDown={handleKeyDown}
    >
      {LEVELS.map((level) => {
        const isActive = level === active;
        return (
          <button
            key={level}
            type="button"
            role="tab"
            data-level={level}
            aria-selected={isActive}
            aria-controls="service-results"
            tabIndex={isActive ? 0 : -1}
            className={`tab${isActive ? " tab--active" : ""}`}
            onClick={() => onChange(level)}
          >
            {level}
            <span className="tab__count">{counts[level]}</span>
          </button>
        );
      })}
    </div>
  );
};

const LevelBadge = ({ level }) => (
  <span className={`badge badge--${level.toLowerCase()}`}>{level}</span>
);

const ServiceCard = ({ service, onStart }) => {
  const Icon = service.icon;
  const levelKey = service.level.toLowerCase();

  return (
    <article className="card">
      <div className="card__head">
        <span
          className={`card__icon card__icon--${levelKey}`}
          aria-hidden="true"
        >
          <Icon size={20} />
        </span>
        <LevelBadge level={service.level} />
      </div>
      <div className="card__body">
        <h2 className="card__title">{service.title}</h2>
        <p className="card__summary">{service.summary}</p>
      </div>
      <div className="card__meta">
        <Clock size={14} aria-hidden="true" />
        Est. {service.time}
      </div>
      <button
        type="button"
        className="btn btn--primary btn--block"
        onClick={() => onStart(service)}
      >
        Start application
        <ArrowRight size={16} aria-hidden="true" />
      </button>
    </article>
  );
};

const AlertsPanel = () => (
  <aside className="sidebar">
    <section className="panel" aria-labelledby="alerts-heading">
      <h3 id="alerts-heading" className="panel__header">
        <Bell size={16} aria-hidden="true" />
        Civic alerts & notices
      </h3>
      <ul className="alert-list">
        {ALERTS.map((alert) => (
          <li key={alert.id} className="alert">
            <span className={`alert__dot alert__dot--${alert.tone}`} />
            <span>{alert.text}</span>
          </li>
        ))}
      </ul>
    </section>

    <section className="panel" aria-labelledby="stats-heading">
      <h3 id="stats-heading" className="panel__header">
        <Landmark size={16} aria-hidden="true" />
        Service directory
      </h3>
      <div className="stats">
        {LEVELS.map((level) => (
          <div key={level} className="stat">
            <div className="stat__value">{LEVEL_TOTALS[level]}</div>
            <div className="stat__label">
              {level === "All" ? "Total services" : level}
            </div>
          </div>
        ))}
      </div>
    </section>
  </aside>
);

const EmptyState = ({ query, level, onReset }) => (
  <div className="empty-state">
    <span className="empty-state__icon" aria-hidden="true">
      <SearchX size={22} />
    </span>
    <p className="empty-state__title">No services found</p>
    <p className="empty-state__text">
      {query
        ? `Nothing ${level === "All" ? "" : `in ${level} `}matches “${query}”. Try a different keyword or category.`
        : `There are no ${level.toLowerCase()} services available yet.`}
    </p>
    <button type="button" className="btn btn--secondary" onClick={onReset}>
      Clear filters
    </button>
  </div>
);

const Stepper = ({ current, onSelect }) => (
  <ol className="stepper" aria-label="Application progress">
    {STEPS.map((step, index) => {
      const isDone = index < current;
      const isActive = index === current;
      const stateClass = isDone
        ? " step--done"
        : isActive
          ? " step--active"
          : "";
      return (
        <li key={step.id} className={`step${stateClass}`}>
          <button
            type="button"
            className="step__button"
            disabled={!isDone}
            aria-current={isActive ? "step" : undefined}
            aria-label={`${step.label}${isDone ? " (completed, edit)" : ""}`}
            onClick={() => onSelect(index)}
          >
            {isDone ? <Check size={16} strokeWidth={3} /> : index + 1}
          </button>
          <span className="step__label">{step.label}</span>
        </li>
      );
    })}
  </ol>
);

const Field = ({ field, value, error, onChange }) => {
  const id = `field-${field.name}`;
  const errorId = `${id}-error`;
  return (
    <div
      className={`field${field.full ? " field--full" : ""}${error ? " field--error" : ""}`}
    >
      <label htmlFor={id} className="field__label">
        {field.label}
        {field.optional && <span className="field__optional"> (optional)</span>}
      </label>
      <input
        id={id}
        name={field.name}
        type={field.type}
        className="field__input"
        placeholder={field.placeholder}
        autoComplete={field.autoComplete}
        value={value}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => onChange(field.name, e.target.value)}
      />
      {error && (
        <span id={errorId} className="field__error" role="alert">
          <CircleAlert size={13} aria-hidden="true" />
          {error}
        </span>
      )}
    </div>
  );
};

const ReviewGroup = ({ step, form, onEdit }) => (
  <div className="review-group">
    <div className="review-group__header">
      {step.title}
      <button type="button" className="link-btn" onClick={onEdit}>
        <Pencil size={12} aria-hidden="true" /> Edit
      </button>
    </div>
    <dl className="review-list">
      {step.fields.map((field) => (
        <div key={field.name}>
          <dt>{field.label}</dt>
          <dd>{form[field.name].trim() || "—"}</dd>
        </div>
      ))}
    </dl>
  </div>
);

const ApplicationModal = ({ service, onClose }) => {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [referenceId, setReferenceId] = useState(null);
  const bodyRef = useRef(null);

  const lastStep = STEPS.length - 1;
  const currentStep = STEPS[step];

  // Close on Escape and lock background scroll while open.
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  // Move focus to the first input whenever the step changes.
  useEffect(() => {
    bodyRef.current?.querySelector(".field__input")?.focus();
    bodyRef.current?.scrollTo({ top: 0 });
  }, [step]);

  const updateField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      if (!(name in prev)) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const goToStep = (index) => {
    setErrors({});
    setStep(index);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const stepErrors = validateStep(step, form);
    setErrors(stepErrors);

    const firstInvalid = Object.keys(stepErrors)[0];
    if (firstInvalid) {
      bodyRef.current?.querySelector(`[name="${firstInvalid}"]`)?.focus();
      return;
    }

    if (step < lastStep) {
      setStep(step + 1);
    } else {
      setReferenceId(`CIV-${Date.now().toString(36).toUpperCase()}`);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onSubmit={handleSubmit}
        noValidate
      >
        <div className="modal__header">
          <div>
            <p className="modal__eyebrow">
              {referenceId ? "Application submitted" : "New application"}
            </p>
            <h2 id="modal-title" className="modal__title">
              {service.title}
              <LevelBadge level={service.level} />
            </h2>
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label="Close"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal__body" ref={bodyRef}>
          {referenceId ? (
            <div className="success" role="status">
              <span className="success__icon" aria-hidden="true">
                <CircleCheck size={34} />
              </span>
              <p className="success__title">You're all set!</p>
              <p className="success__text">
                We've received your {service.title.toLowerCase()} application. A
                confirmation has been sent to <strong>{form.email}</strong>.
                Estimated processing time: {service.time}.
              </p>
              <span className="success__ref">{referenceId}</span>
            </div>
          ) : (
            <>
              <Stepper current={step} onSelect={goToStep} />

              <h3 className="form-section-title">{currentStep.title}</h3>
              <p className="form-section-text">{currentStep.description}</p>

              {step < lastStep ? (
                <div className="fields fields--two">
                  {currentStep.fields.map((field) => (
                    <Field
                      key={field.name}
                      field={field}
                      value={form[field.name]}
                      error={errors[field.name]}
                      onChange={updateField}
                    />
                  ))}
                </div>
              ) : (
                <>
                  {STEPS.slice(0, lastStep).map((s, index) => (
                    <ReviewGroup
                      key={s.id}
                      step={s}
                      form={form}
                      onEdit={() => goToStep(index)}
                    />
                  ))}
                  <label
                    className={`checkbox${errors.consent ? " checkbox--error" : ""}`}
                  >
                    <input
                      type="checkbox"
                      name="consent"
                      checked={form.consent}
                      onChange={(e) => updateField("consent", e.target.checked)}
                    />
                    <span>
                      I confirm the information above is accurate and I consent
                      to it being used to process this application.
                    </span>
                  </label>
                  {errors.consent && (
                    <p className="field__error" role="alert">
                      <CircleAlert size={13} aria-hidden="true" />
                      {errors.consent}
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </div>

        <div className="modal__footer">
          {referenceId ? (
            <div className="modal__footer-end">
              <button
                type="button"
                className="btn btn--primary"
                onClick={onClose}
              >
                Done
              </button>
            </div>
          ) : (
            <>
              {step > 0 ? (
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => goToStep(step - 1)}
                >
                  <ChevronLeft size={16} aria-hidden="true" />
                  Back
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={onClose}
                >
                  Cancel
                </button>
              )}
              <div className="modal__footer-end">
                {step < lastStep ? (
                  <button type="submit" className="btn btn--primary">
                    Continue
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                ) : (
                  <button type="submit" className="btn btn--success">
                    <ShieldCheck size={16} aria-hidden="true" />
                    Submit application
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </form>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

const CivicOS = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeLevel, setActiveLevel] = useState("All");
  const [selectedService, setSelectedService] = useState(null);

  const query = normalize(searchQuery);

  const searchMatches = useMemo(
    () => SERVICES.filter((service) => matchesQuery(service, query)),
    [query],
  );

  const counts = useMemo(
    () =>
      LEVELS.reduce((acc, level) => {
        acc[level] =
          level === "All"
            ? searchMatches.length
            : searchMatches.filter((s) => s.level === level).length;
        return acc;
      }, {}),
    [searchMatches],
  );

  const filteredServices = useMemo(
    () =>
      activeLevel === "All"
        ? searchMatches
        : searchMatches.filter((s) => s.level === activeLevel),
    [searchMatches, activeLevel],
  );

  const resetFilters = () => {
    setSearchQuery("");
    setActiveLevel("All");
  };

  const closeModal = useCallback(() => setSelectedService(null), []);

  return (
    <div className="app">
      <Header />

      <div className="page">
        <section className="hero">
          <h1 className="hero__title">Civic services</h1>
          <p className="hero__subtitle">
            Find and apply for municipal, provincial and federal services in one
            place.
          </p>
        </section>

        <div className="layout">
          <main className="main">
            <div className="toolbar">
              <SearchBar value={searchQuery} onChange={setSearchQuery} />
              <CategoryTabs
                active={activeLevel}
                counts={counts}
                onChange={setActiveLevel}
              />
            </div>

            <p className="results-meta" aria-live="polite">
              Showing <strong>{filteredServices.length}</strong> of{" "}
              <strong>{SERVICES.length}</strong> services
            </p>

            <div id="service-results" role="tabpanel">
              {filteredServices.length > 0 ? (
                <div className="grid">
                  {filteredServices.map((service) => (
                    <ServiceCard
                      key={service.id}
                      service={service}
                      onStart={setSelectedService}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  query={searchQuery.trim()}
                  level={activeLevel}
                  onReset={resetFilters}
                />
              )}
            </div>
          </main>

          <AlertsPanel />
        </div>
      </div>

      {selectedService && (
        <ApplicationModal
          key={selectedService.id}
          service={selectedService}
          onClose={closeModal}
        />
      )}
    </div>
  );
};

export default CivicOS;
