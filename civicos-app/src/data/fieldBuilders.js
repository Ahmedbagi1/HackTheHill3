/**
 * Small factories that produce wizard field schemas. They keep
 * servicesData.js readable and give every service the same conventions.
 *
 * Field schema reference (consumed by FieldRenderer + lib/validation):
 *   name, label, type        type is one of FIELD_TYPES below
 *   optional                 skip the required check when empty
 *   options                  [{ value, label, hint? }]  (select / radio / checkbox-group)
 *   pattern                  { regex, message } tested against the trimmed value
 *   validate(value, data)    custom rule returning an error string or null
 *   min, max, step           number constraints (step 1 => whole numbers)
 *   prefix, suffix           adornments; also used when formatting answers
 *   notAfterToday / notBeforeToday   date constraints
 *   transform                "uppercase"
 *   suggestions              string[] rendered as a <datalist>
 *   showIf(data)             hidden fields are not validated or reviewed
 *   compute(data)            estimate fields: returns an EstimateResult or null
 *   full                     span both grid columns
 *   hint, placeholder, autoComplete, inputMode, maxLength, rows,
 *   requiredMessage, reviewLabel
 */

export const FIELD_TYPES = Object.freeze([
  "text",
  "email",
  "tel",
  "number",
  "date",
  "textarea",
  "select",
  "radio",
  "checkbox-group",
  "checkbox",
  "info",
  "estimate",
  "waste-lookup",
  "geotag",
]);

/* ------------------------------------------------------------------------ */
/* Patterns & rules                                                         */
/* ------------------------------------------------------------------------ */

export const PATTERNS = {
  email: {
    regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message: "Enter a valid email address.",
  },
  phone: {
    regex: /^[\d\s()+.-]{10,}$/,
    message: "Enter a 10-digit phone number.",
  },
  postalCode: {
    regex: /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d$/i,
    message: "Use the format A1A 1A1.",
  },
  vin: {
    regex: /^[A-HJ-NPR-Z0-9]{17}$/,
    message: "VIN must be 17 letters or digits (no I, O or Q).",
  },
  ontarioLicence: {
    regex: /^[A-Z]\d{4}-?\d{5}-?\d{5}$/,
    message: "Use the format A1234-12345-12345.",
  },
  ohip: {
    regex: /^\d{4}[\s-]?\d{3}[\s-]?\d{3}([\s-]?[A-Z]{1,2})?$/,
    message: "Enter your 10-digit health number (version code optional).",
  },
  passport: {
    regex: /^[A-Z]{2}\d{6}$/,
    message: "Use 2 letters followed by 6 digits, e.g. AB123456.",
  },
  plate: {
    regex: /^[A-Z0-9 ]{2,8}$/,
    message: "Plates are 2–8 letters or digits.",
  },
  uci: {
    regex: /^(\d{8}|\d{10}|\d{4}-\d{4}|\d{2}-\d{4}-\d{4})$/,
    message: "A UCI is 8 or 10 digits.",
  },
};

const digitsOnly = (value) => value.replace(/\D/g, "");

/** Luhn check used for Social Insurance Numbers. */
export const passesLuhn = (value) => {
  const digits = digitsOnly(value);
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return digits.length > 0 && sum % 10 === 0;
};

export const validateSin = (value) => {
  const digits = digitsOnly(value);
  if (digits.length !== 9) return "A SIN has 9 digits.";
  if (!passesLuhn(digits)) return "That SIN doesn't pass the check-digit test.";
  return null;
};

/** Returns a showIf predicate: the named field equals one of the values. */
export const when =
  (name, ...values) =>
  (data) =>
    values.includes(data[name]);

/* ------------------------------------------------------------------------ */
/* Builders                                                                 */
/* ------------------------------------------------------------------------ */

const toOptions = (options) =>
  options.map((option) =>
    typeof option === "string"
      ? { value: option, label: option }
      : Array.isArray(option)
        ? { value: option[0], label: option[1] ?? option[0], hint: option[2] }
        : option,
  );

export const text = (name, label, opts = {}) => ({
  name,
  label,
  type: "text",
  ...opts,
});

export const textarea = (name, label, opts = {}) => ({
  name,
  label,
  type: "textarea",
  rows: 4,
  maxLength: 1000,
  full: true,
  ...opts,
});

export const number = (name, label, opts = {}) => ({
  name,
  label,
  type: "number",
  min: 0,
  step: 1,
  inputMode: "numeric",
  ...opts,
});

export const money = (name, label, opts = {}) => ({
  name,
  label,
  type: "number",
  prefix: "$",
  currency: true,
  min: 0,
  step: 0.01,
  inputMode: "decimal",
  ...opts,
});

/**
 * Builders whose output may vary by language. Money inputs are identical in
 * every language today (answers are formatted via `currency`), so the kit is
 * shared; callers pass `lang` so locale-specific variants can slot in later.
 */
export const getFieldKit = () => ({ money });

export const date = (name, label, opts = {}) => ({
  name,
  label,
  type: "date",
  ...opts,
});

export const select = (name, label, options, opts = {}) => ({
  name,
  label,
  type: "select",
  options: toOptions(options),
  ...opts,
});

export const radio = (name, label, options, opts = {}) => ({
  name,
  label,
  type: "radio",
  options: toOptions(options),
  full: true,
  ...opts,
});

export const checks = (name, label, options, opts = {}) => ({
  name,
  label,
  type: "checkbox-group",
  options: toOptions(options),
  full: true,
  ...opts,
});

export const declaration = (name, label, opts = {}) => ({
  name,
  label,
  type: "checkbox",
  full: true,
  reviewLabel: "Declaration",
  requiredMessage: "Please confirm this declaration to continue.",
  ...opts,
});

export const info = (name, label, opts = {}) => ({
  name,
  label,
  type: "info",
  full: true,
  ...opts,
});

export const estimate = (name, label, compute, opts = {}) => ({
  name,
  label,
  type: "estimate",
  compute,
  full: true,
  ...opts,
});

export const wasteLookup = (name = "wasteSchedule", opts = {}) => ({
  name,
  label: "Ottawa address lookup",
  type: "waste-lookup",
  full: true,
  requiredMessage: "Look up your address to find your collection day.",
  ...opts,
});

export const geotag = (name = "location", opts = {}) => ({
  name,
  label: "Pin the location",
  type: "geotag",
  full: true,
  optional: true,
  ...opts,
});

/* ------------------------------------------------------------------------ */
/* Common presets                                                           */
/* ------------------------------------------------------------------------ */

export const fullName = (opts = {}) =>
  text("fullName", "Full legal name", {
    autoComplete: "name",
    placeholder: "Jane Doe",
    ...opts,
  });

export const dateOfBirth = (opts = {}) =>
  date("dateOfBirth", "Date of birth", {
    autoComplete: "bday",
    notAfterToday: true,
    ...opts,
  });

export const emailField = (opts = {}) => ({
  name: "email",
  label: "Email address",
  type: "email",
  autoComplete: "email",
  placeholder: "jane@example.com",
  pattern: PATTERNS.email,
  ...opts,
});

export const phoneField = (opts = {}) => ({
  name: "phone",
  label: "Phone number",
  type: "tel",
  autoComplete: "tel",
  placeholder: "(613) 555-0123",
  pattern: PATTERNS.phone,
  ...opts,
});

export const streetAddress = (opts = {}) =>
  text("streetAddress", "Street address", {
    autoComplete: "street-address",
    placeholder: "110 Laurier Ave W",
    full: true,
    ...opts,
  });

export const postalCode = (opts = {}) =>
  text("postalCode", "Postal code", {
    autoComplete: "postal-code",
    placeholder: "K1P 1J1",
    maxLength: 7,
    transform: "uppercase",
    pattern: PATTERNS.postalCode,
    ...opts,
  });

export const sinField = (opts = {}) =>
  text("sin", "Social Insurance Number", {
    placeholder: "123 456 782",
    inputMode: "numeric",
    maxLength: 11,
    autoComplete: "off",
    validate: validateSin,
    hint: "Used only to match your file. Never share it by email.",
    ...opts,
  });
