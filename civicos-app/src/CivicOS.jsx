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

/* -------------------------------------------------------------------------- */
/* Application schemas                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Field schema:
 *   name          key in formData
 *   label         visible label (or declaration text for type "checkbox")
 *   type          text | email | tel | number | date | select | radio |
 *                 checkbox-group | checkbox
 *   optional      skip the required check when empty
 *   options       [{ value, label, hint? }] for select / radio / checkbox-group
 *   pattern       { regex, message } checked against the trimmed value
 *   min, max, step            number constraints
 *   prefix, suffix            input adornments, also used when formatting answers
 *   notAfterToday             date may not be in the future
 *   transform     "uppercase" to normalise identifiers while typing
 *   suggestions   string[] rendered as a <datalist> for lookup-style inputs
 *   showIf        (formData) => boolean; hidden fields are not validated or reviewed
 *   full          span both grid columns
 *   hint, placeholder, autoComplete, inputMode, maxLength, requiredMessage
 */
const APPLICATION_SCHEMAS = {
  "vehicle-registration": {
    confirmation:
      "Bring your insurance slip when you collect your plates and permit.",
    primary: {
      description: "Tell us about the vehicle you are registering.",
      fields: [
        {
          name: "vin",
          label: "VIN number",
          type: "text",
          placeholder: "1HGCM82633A004352",
          maxLength: 17,
          transform: "uppercase",
          autoComplete: "off",
          pattern: {
            regex: /^[A-HJ-NPR-Z0-9]{17}$/,
            message: "VIN must be 17 letters or digits (no I, O or Q).",
          },
          hint: "Found on the driver's side dashboard or door frame.",
          full: true,
        },
        {
          name: "make",
          label: "Vehicle make",
          type: "text",
          placeholder: "Toyota",
        },
        {
          name: "model",
          label: "Vehicle model",
          type: "text",
          placeholder: "Corolla",
        },
        {
          name: "purchasePrice",
          label: "Purchase price",
          type: "number",
          prefix: "$",
          min: 0,
          step: 0.01,
          inputMode: "decimal",
          placeholder: "24,500.00",
          full: true,
        },
      ],
    },
    verification: {
      description: "We need proof of insurance and the current odometer value.",
      fields: [
        {
          name: "insurancePolicy",
          label: "Insurance policy number",
          type: "text",
          placeholder: "POL-12345678",
          transform: "uppercase",
          autoComplete: "off",
          pattern: {
            regex: /^[A-Z0-9-]{6,20}$/,
            message: "Use 6–20 letters, digits or dashes.",
          },
        },
        {
          name: "odometer",
          label: "Odometer reading",
          type: "number",
          suffix: "km",
          min: 0,
          step: 1,
          inputMode: "numeric",
          placeholder: "42000",
        },
      ],
    },
  },

  "lost-wallet": {
    confirmation:
      "If you requested a police report, an officer will contact you within 2 business days.",
    primary: {
      description: "Tell us when and where the wallet went missing.",
      fields: [
        {
          name: "incidentDate",
          label: "Incident date",
          type: "date",
          notAfterToday: true,
        },
        {
          name: "locationLost",
          label: "Location lost",
          type: "text",
          placeholder: "e.g. Rideau Centre, 50 Rideau St",
          hint: "A street address, landmark or transit route.",
          full: true,
        },
      ],
    },
    verification: {
      description:
        "Select the cards that need replacing and whether you need a police report.",
      fields: [
        {
          name: "cardsLost",
          label: "Cards lost",
          type: "checkbox-group",
          optional: true,
          options: [
            { value: "drivers-license", label: "Driver's License" },
            { value: "health-card", label: "Health Card" },
          ],
          hint: "We'll start a replacement request for each card you select.",
          full: true,
        },
        {
          name: "policeReport",
          label: "Do you need a police report?",
          type: "radio",
          options: [
            {
              value: "yes",
              label: "Yes, file a report",
              hint: "Recommended if you suspect theft.",
            },
            {
              value: "no",
              label: "No, not needed",
              hint: "The wallet was misplaced.",
            },
          ],
          full: true,
        },
      ],
    },
  },

  passport: {
    confirmation: "Keep your current passport until we ask you to send it in.",
    primary: {
      description: "Enter the details from your most recent passport.",
      fields: [
        {
          name: "passportNumber",
          label: "Current passport number",
          type: "text",
          placeholder: "AB123456",
          maxLength: 8,
          transform: "uppercase",
          autoComplete: "off",
          pattern: {
            regex: /^[A-Z]{2}\d{6}$/,
            message: "Use 2 letters followed by 6 digits, e.g. AB123456.",
          },
        },
        {
          name: "passportExpiry",
          label: "Expiry date",
          type: "date",
        },
      ],
    },
    verification: {
      description:
        "Your guarantor must have known you for at least 2 years. Choose how quickly you need the passport.",
      fields: [
        {
          name: "guarantorName",
          label: "Guarantor name",
          type: "text",
          placeholder: "Full legal name of your guarantor",
          autoComplete: "off",
          full: true,
        },
        {
          name: "pickupOption",
          label: "Urgent pickup selection",
          type: "select",
          options: [
            { value: "standard", label: "Standard mail (20 business days)" },
            { value: "express", label: "Express pickup (2–9 business days)" },
            { value: "urgent", label: "Urgent pickup (next business day)" },
          ],
          hint: "Express and urgent pickup carry additional fees.",
          full: true,
        },
      ],
    },
  },

  "drivers-license": {
    confirmation:
      "Your new card will arrive by mail. Carry the temporary licence until then.",
    primary: {
      description:
        "Enter the licence you are renewing and your organ donor preference.",
      fields: [
        {
          name: "licenseNumber",
          label: "Existing license number",
          type: "text",
          placeholder: "A1234-12345-12345",
          maxLength: 17,
          transform: "uppercase",
          autoComplete: "off",
          pattern: {
            regex: /^[A-Z]\d{4}-?\d{5}-?\d{5}$/,
            message: "Use the format A1234-12345-12345.",
          },
          full: true,
        },
        {
          name: "organDonor",
          label: "Organ donor preference",
          type: "radio",
          options: [
            {
              value: "yes",
              label: "Register me",
              hint: "Add me to the donor registry.",
            },
            { value: "no", label: "Do not register" },
            { value: "undecided", label: "Decide later" },
          ],
          full: true,
        },
      ],
    },
    verification: {
      description: "Drivers must meet minimum vision standards to renew.",
      fields: [
        {
          name: "correctiveLenses",
          label: "Do you wear corrective lenses while driving?",
          type: "radio",
          options: [
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
          ],
          full: true,
        },
        {
          name: "visionDeclaration",
          label:
            "I declare that my vision meets the minimum standard for driving, with corrective lenses if I need them.",
          reviewLabel: "Vision declaration",
          type: "checkbox",
          requiredMessage: "You must accept the vision declaration to renew.",
          full: true,
        },
      ],
    },
  },

  "trash-pickup": {
    confirmation:
      "Your collection calendar is ready. Reminders start before your next pickup.",
    primary: {
      description: "Look up your address to find your collection schedule.",
      fields: [
        {
          name: "address",
          label: "Address lookup",
          type: "text",
          placeholder: "Start typing your street address",
          autoComplete: "street-address",
          suggestions: [
            "1 Elgin St",
            "50 Rideau St",
            "110 Laurier Ave W",
            "300 Sparks St",
            "455 Bank St",
          ],
          full: true,
        },
        {
          name: "propertyType",
          label: "Property type",
          type: "radio",
          options: [
            { value: "single", label: "Single home", hint: "Curbside pickup." },
            {
              value: "multi-unit",
              label: "Multi-unit",
              hint: "Shared bins or depot.",
            },
          ],
          full: true,
        },
        {
          name: "unitCount",
          label: "Number of units",
          type: "number",
          min: 2,
          max: 500,
          step: 1,
          inputMode: "numeric",
          placeholder: "12",
          showIf: (data) => data.propertyType === "multi-unit",
        },
      ],
    },
    verification: {
      description: "Choose how you'd like to be reminded before pickup day.",
      fields: [
        {
          name: "alertMethod",
          label: "Notification alert preference",
          type: "select",
          options: [
            { value: "email", label: "Email" },
            { value: "sms", label: "Text message (SMS)" },
            { value: "app", label: "CivicOS app notification" },
            { value: "none", label: "No reminders" },
          ],
          full: true,
        },
        {
          name: "alertEmail",
          label: "Email for reminders",
          type: "email",
          autoComplete: "email",
          placeholder: "jane@example.com",
          pattern: { regex: EMAIL_RE, message: "Enter a valid email address." },
          showIf: (data) => data.alertMethod === "email",
          full: true,
        },
        {
          name: "alertPhone",
          label: "Mobile number for reminders",
          type: "tel",
          autoComplete: "tel",
          placeholder: "(613) 555-0123",
          pattern: { regex: PHONE_RE, message: "Enter a valid phone number." },
          showIf: (data) => data.alertMethod === "sms",
          full: true,
        },
      ],
    },
  },

  "utility-bill": {
    confirmation:
      "A receipt will be available in your account within 24 hours.",
    primary: {
      description: "Find the account and meter details on your latest bill.",
      fields: [
        {
          name: "accountNumber",
          label: "Account number",
          type: "text",
          inputMode: "numeric",
          placeholder: "0012345678",
          maxLength: 12,
          autoComplete: "off",
          pattern: {
            regex: /^\d{6,12}$/,
            message: "Account numbers are 6–12 digits.",
          },
        },
        {
          name: "meterReading",
          label: "Meter reading",
          type: "number",
          suffix: "kWh",
          min: 0,
          step: 1,
          inputMode: "numeric",
          placeholder: "18250",
        },
      ],
    },
    verification: {
      description: "Confirm how much you're paying and how.",
      fields: [
        {
          name: "paymentAmount",
          label: "Payment amount",
          type: "number",
          prefix: "$",
          min: 0.01,
          step: 0.01,
          inputMode: "decimal",
          placeholder: "128.40",
        },
        {
          name: "paymentMethod",
          label: "Payment method",
          type: "select",
          options: [
            { value: "debit", label: "Pre-authorized debit" },
            { value: "credit", label: "Credit card" },
            { value: "banking", label: "Online banking" },
          ],
        },
      ],
    },
  },
};

/** Step 1 and 2 come from the service schema; step 3 is always the review. */
const buildSteps = (schema) => [
  {
    id: "primary",
    label: "Details",
    title: "Primary details",
    ...schema.primary,
  },
  {
    id: "verification",
    label: "Verification",
    title: "Verification & requirements",
    ...schema.verification,
  },
  {
    id: "review",
    label: "Review",
    title: "Review & summary",
    description: "Check your answers before you submit the application.",
    fields: [],
  },
];

const CHOICE_TYPES = new Set(["select", "radio"]);

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

const todayISO = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
};

const emptyValueFor = (field) => {
  if (field.type === "checkbox-group") return [];
  if (field.type === "checkbox") return false;
  return "";
};

const buildInitialFormData = (schema) => {
  const data = { consent: false };
  for (const field of [
    ...schema.primary.fields,
    ...schema.verification.fields,
  ]) {
    data[field.name] = emptyValueFor(field);
  }
  return data;
};

const isVisible = (field, formData) => !field.showIf || field.showIf(formData);

const visibleFields = (fields, formData) =>
  fields.filter((field) => isVisible(field, formData));

const isEmptyValue = (field, value) => {
  if (field.type === "checkbox-group") return value.length === 0;
  if (field.type === "checkbox") return !value;
  return String(value).trim() === "";
};

const withUnits = (field, amount) =>
  `${field.prefix ?? ""}${amount}${field.suffix ? ` ${field.suffix}` : ""}`;

const validateField = (field, value) => {
  if (isEmptyValue(field, value)) {
    if (field.optional) return null;
    if (field.requiredMessage) return field.requiredMessage;
    return CHOICE_TYPES.has(field.type)
      ? "Please choose an option."
      : `${field.label} is required.`;
  }

  if (typeof value !== "string") return null;
  const text = value.trim();

  if (field.pattern && !field.pattern.regex.test(text)) {
    return field.pattern.message;
  }

  if (field.type === "number") {
    const amount = Number(text);
    if (!Number.isFinite(amount)) return "Enter a valid number.";
    if (field.min !== undefined && amount < field.min)
      return `Must be at least ${withUnits(field, field.min)}.`;
    if (field.max !== undefined && amount > field.max)
      return `Must be ${withUnits(field, field.max)} or less.`;
    if (field.step === 1 && !Number.isInteger(amount))
      return "Enter a whole number.";
  }

  if (field.type === "date") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "Enter a valid date.";
    if (field.notAfterToday && text > todayISO())
      return "Date can't be in the future.";
  }

  return null;
};

const validateFields = (fields, formData) => {
  const errors = {};
  for (const field of visibleFields(fields, formData)) {
    const error = validateField(field, formData[field.name]);
    if (error) errors[field.name] = error;
  }
  return errors;
};

const currencyFormat = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
});

const dateFormat = new Intl.DateTimeFormat("en-CA", { dateStyle: "long" });

const optionLabel = (field, value) =>
  field.options.find((option) => option.value === value)?.label ?? value;

const formatAnswer = (field, value) => {
  if (isEmptyValue(field, value)) {
    if (field.type === "checkbox-group") return "None selected";
    if (field.type === "checkbox") return "Not confirmed";
    return "—";
  }

  switch (field.type) {
    case "select":
    case "radio":
      return optionLabel(field, value);
    case "checkbox-group":
      return value.map((v) => optionLabel(field, v)).join(", ");
    case "checkbox":
      return "Confirmed";
    case "number": {
      const amount = Number(value);
      if (field.prefix === "$") return currencyFormat.format(amount);
      return withUnits(field, amount.toLocaleString("en-CA"));
    }
    case "date": {
      // Parse as a local date so the day doesn't shift across time zones.
      const [year, month, day] = value.split("-").map(Number);
      return dateFormat.format(new Date(year, month - 1, day));
    }
    default:
      return value.trim();
  }
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

const Stepper = ({ steps, current, onSelect }) => (
  <ol className="stepper" aria-label="Application progress">
    {steps.map((step, index) => {
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

const FieldError = ({ id, message }) =>
  message ? (
    <span id={id} className="field__error" role="alert">
      <CircleAlert size={13} aria-hidden="true" />
      {message}
    </span>
  ) : null;

const FieldHint = ({ id, text }) =>
  text ? (
    <span id={id} className="field__hint">
      {text}
    </span>
  ) : null;

const OptionalTag = ({ field }) =>
  field.optional ? <span className="field__optional"> (optional)</span> : null;

const FormField = ({ field, value, error, onChange }) => {
  const id = `field-${field.name}`;
  const hintId = field.hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  const fieldClass = `field${field.full ? " field--full" : ""}${error ? " field--error" : ""}`;

  // Single declaration checkbox, e.g. vision declaration.
  if (field.type === "checkbox") {
    return (
      <div className={fieldClass}>
        <label className={`checkbox${error ? " checkbox--error" : ""}`}>
          <input
            type="checkbox"
            name={field.name}
            checked={value}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            onChange={(e) => onChange(field.name, e.target.checked)}
          />
          <span>{field.label}</span>
        </label>
        <FieldHint id={hintId} text={field.hint} />
        <FieldError id={errorId} message={error} />
      </div>
    );
  }

  // Radio buttons and multi-select checkboxes rendered as choice cards.
  if (field.type === "radio" || field.type === "checkbox-group") {
    const isMulti = field.type === "checkbox-group";
    const toggle = (optionValue, checked) => {
      if (!isMulti) return onChange(field.name, optionValue);
      const selected = new Set(value);
      if (checked) selected.add(optionValue);
      else selected.delete(optionValue);
      // Keep answers in option order regardless of click order.
      onChange(
        field.name,
        field.options.map((o) => o.value).filter((v) => selected.has(v)),
      );
    };

    return (
      <fieldset
        className={fieldClass}
        aria-describedby={describedBy}
        aria-invalid={Boolean(error)}
      >
        <legend className="field__label">
          {field.label}
          <OptionalTag field={field} />
        </legend>
        <div className="choice-group">
          {field.options.map((option) => {
            const checked = isMulti
              ? value.includes(option.value)
              : value === option.value;
            return (
              <label
                key={option.value}
                className={`choice${checked ? " choice--selected" : ""}`}
              >
                <input
                  type={isMulti ? "checkbox" : "radio"}
                  className="choice__input"
                  name={field.name}
                  value={option.value}
                  checked={checked}
                  onChange={(e) => toggle(option.value, e.target.checked)}
                />
                <span className="choice__text">
                  <span className="choice__label">{option.label}</span>
                  {option.hint && (
                    <span className="choice__hint">{option.hint}</span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
        <FieldHint id={hintId} text={field.hint} />
        <FieldError id={errorId} message={error} />
      </fieldset>
    );
  }

  const commonProps = {
    id,
    name: field.name,
    value,
    "aria-invalid": Boolean(error),
    "aria-required": !field.optional,
    "aria-describedby": describedBy,
  };

  let control;
  if (field.type === "select") {
    control = (
      <select
        {...commonProps}
        className="field__input field__select"
        required={!field.optional}
        onChange={(e) => onChange(field.name, e.target.value)}
      >
        <option value="" disabled>
          Select an option
        </option>
        {field.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  } else {
    const listId = field.suggestions ? `${id}-suggestions` : undefined;
    const inputClass = [
      "field__input",
      field.prefix && "field__input--has-prefix",
      field.suffix && "field__input--has-suffix",
    ]
      .filter(Boolean)
      .join(" ");

    control = (
      <>
        <div className="input-group">
          {field.prefix && (
            <span
              className="input-group__affix input-group__affix--prefix"
              aria-hidden="true"
            >
              {field.prefix}
            </span>
          )}
          <input
            {...commonProps}
            type={field.type}
            className={inputClass}
            placeholder={field.placeholder}
            autoComplete={field.autoComplete}
            inputMode={field.inputMode}
            maxLength={field.maxLength}
            min={field.type === "date" ? undefined : field.min}
            max={
              field.type === "date"
                ? field.notAfterToday
                  ? todayISO()
                  : undefined
                : field.max
            }
            step={field.step}
            list={listId}
            onChange={(e) =>
              onChange(
                field.name,
                field.transform === "uppercase"
                  ? e.target.value.toUpperCase()
                  : e.target.value,
              )
            }
          />
          {field.suffix && (
            <span
              className="input-group__affix input-group__affix--suffix"
              aria-hidden="true"
            >
              {field.suffix}
            </span>
          )}
        </div>
        {listId && (
          <datalist id={listId}>
            {field.suggestions.map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>
        )}
      </>
    );
  }

  return (
    <div className={fieldClass}>
      <label htmlFor={id} className="field__label">
        {field.label}
        {field.prefix || field.suffix ? (
          <span className="sr-only">
            {" "}
            (in {field.prefix === "$" ? "dollars" : field.suffix})
          </span>
        ) : null}
        <OptionalTag field={field} />
      </label>
      {control}
      <FieldHint id={hintId} text={field.hint} />
      <FieldError id={errorId} message={error} />
    </div>
  );
};

const ReviewGroup = ({ step, formData, onEdit }) => (
  <div className="review-group">
    <div className="review-group__header">
      {step.title}
      <button type="button" className="link-btn" onClick={onEdit}>
        <Pencil size={12} aria-hidden="true" /> Edit
      </button>
    </div>
    <dl className="review-list">
      {visibleFields(step.fields, formData).map((field) => (
        <div key={field.name}>
          <dt>{field.reviewLabel ?? field.label}</dt>
          <dd>{formatAnswer(field, formData[field.name])}</dd>
        </div>
      ))}
    </dl>
  </div>
);

const ApplicationModal = ({ service, onClose }) => {
  const schema = APPLICATION_SCHEMAS[service.id];
  const steps = useMemo(() => buildSteps(schema), [schema]);

  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState(() => buildInitialFormData(schema));
  const [errors, setErrors] = useState({});
  const [referenceId, setReferenceId] = useState(null);
  const bodyRef = useRef(null);

  const lastStep = steps.length - 1;
  const currentStep = steps[step];

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

  // Move focus to the first control whenever the step changes.
  useEffect(() => {
    bodyRef.current?.querySelector(".fields input, .fields select")?.focus();
    bodyRef.current?.scrollTo({ top: 0 });
  }, [step]);

  const updateField = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
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

    const stepErrors =
      step < lastStep
        ? validateFields(currentStep.fields, formData)
        : formData.consent
          ? {}
          : { consent: "Please confirm the information is accurate." };
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
                We've received your {service.title.toLowerCase()} request.{" "}
                {schema.confirmation} Estimated processing time: {service.time}.
              </p>
              <span className="success__ref">{referenceId}</span>
            </div>
          ) : (
            <>
              <Stepper steps={steps} current={step} onSelect={goToStep} />

              <h3 className="form-section-title">
                Step {step + 1}: {currentStep.title}
              </h3>
              <p className="form-section-text">{currentStep.description}</p>

              {step < lastStep ? (
                <div className="fields fields--two">
                  {visibleFields(currentStep.fields, formData).map((field) => (
                    <FormField
                      key={field.name}
                      field={field}
                      value={formData[field.name]}
                      error={errors[field.name]}
                      onChange={updateField}
                    />
                  ))}
                </div>
              ) : (
                <>
                  {steps.slice(0, lastStep).map((s, index) => (
                    <ReviewGroup
                      key={s.id}
                      step={s}
                      formData={formData}
                      onEdit={() => goToStep(index)}
                    />
                  ))}
                  <label
                    className={`checkbox${errors.consent ? " checkbox--error" : ""}`}
                  >
                    <input
                      type="checkbox"
                      name="consent"
                      checked={formData.consent}
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
                    Next
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
  const [activeService, setActiveService] = useState(null);

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

  const closeModal = useCallback(() => setActiveService(null), []);

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
                      onStart={setActiveService}
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

      {/* Keyed by service so each application starts with a fresh formData. */}
      {activeService && (
        <ApplicationModal
          key={activeService.id}
          service={activeService}
          onClose={closeModal}
        />
      )}
    </div>
  );
};

export default CivicOS;
