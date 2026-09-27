/**
 * Shared intake presets that mirror the identity, contact, address and
 * declaration blocks found on official Canadian application forms.
 *
 * Every preset accepts `showIf` (a `when`/`allWhen` predicate) so a block can
 * be limited to one branch of a form, and `officialRef` so the review packet
 * can cite the section of the official form each answer belongs to.
 */

import { PROVINCES } from "./provinces";
import { allWhen, date, dateOfBirth, declaration, emailField, info, phoneField, postalCode, radio, select, text, when } from "./fieldBuilders";

export const PROVINCE_OPTIONS = PROVINCES.map((province) => [province.code, province.name]);

export const SEX_OPTIONS = [
  ["F", "F (female)"],
  ["M", "M (male)"],
  ["X", "X (another gender)"],
];

export const MARITAL_OPTIONS = [
  ["single", "Single"],
  ["married", "Married"],
  ["common-law", "Common-law"],
  ["separated", "Separated"],
  ["divorced", "Divorced"],
  ["widowed", "Widowed"],
];

export const STATUS_OPTIONS = [
  ["citizen", "Canadian citizen"],
  ["pr", "Permanent resident"],
  ["protected", "Protected person"],
  ["temporary", "Temporary resident (work or study permit)"],
];

const yesNo = [
  ["yes", "Yes"],
  ["no", "No"],
];

/** Combines an optional branch condition with a block-level condition. */
const scoped = (showIf, extra) => (showIf && extra ? allWhen(showIf, extra) : showIf ?? extra);
const meta = ({ showIf, officialRef }) => ({ ...(showIf && { showIf }), ...(officialRef && { officialRef }) });

/* ------------------------------------------------------------------------ */
/* Identity                                                                 */
/* ------------------------------------------------------------------------ */

/** Surname and given names exactly as on the applicant's identity documents. */
export const legalName = ({ prefix = "legal", surnameLabel = "Surname (legal last name)", givenLabel = "Given name(s)", ...opts } = {}) => [
  text(`${prefix}Surname`, surnameLabel, {
    autoComplete: prefix === "legal" ? "family-name" : "off",
    ...(prefix === "legal" && { hint: "Exactly as on your identity documents." }),
    ...meta(opts),
  }),
  text(`${prefix}GivenNames`, givenLabel, { autoComplete: prefix === "legal" ? "given-name" : "off", ...meta(opts) }),
];

export const formerSurnames = (opts = {}) =>
  text("formerSurnames", "Former surnames, if any", { optional: true, hint: "Including a surname at birth or before marriage.", ...meta(opts) });

export const parentSurnameAtBirth = (opts = {}) =>
  text("parentSurnameAtBirth", "Surname at birth of one of your parents", { hint: "Used to confirm your identity.", ...meta(opts) });

export const applicantDob = (opts = {}) => dateOfBirth(meta(opts));

export const sexField = (opts = {}) => radio("sex", "Sex (as on your identity documents)", SEX_OPTIONS, meta(opts));

export const placeOfBirth = (opts = {}) => [
  text("birthCity", "City or town of birth", meta(opts)),
  text("birthCountry", "Country of birth", { placeholder: "Canada", ...meta(opts) }),
];

export const statusInCanada = (opts = {}) => select("statusInCanada", "Status in Canada", STATUS_OPTIONS, { full: true, ...meta(opts) });

/* ------------------------------------------------------------------------ */
/* Contact                                                                  */
/* ------------------------------------------------------------------------ */

export const contactFields = ({ emailOptional = false, phoneOptional = false, ...opts } = {}) => [
  emailField({ ...(emailOptional && { optional: true }), ...meta(opts) }),
  phoneField({ label: "Daytime phone number", ...(phoneOptional && { optional: true }), ...meta(opts) }),
];

/* ------------------------------------------------------------------------ */
/* Addresses                                                                */
/* ------------------------------------------------------------------------ */

// [heading, street, unit, city, province, postal code] review labels per address role.
const ADDRESS_LABELS = {
  home: ["Home (residential) address", "Home street address", "Home unit", "Home city or town", "Home province or territory", "Home postal code"],
  mailing: ["Mailing address", "Mailing street address", "Mailing unit", "Mailing city or town", "Mailing province or territory", "Mailing postal code"],
  property: ["Property address", "Property street address", "Property unit", "Property city or town", "Property province", "Property postal code"],
  rental: ["Rental unit address", "Rental unit street address", "Rental unit number", "Rental unit municipality", "Rental unit province", "Rental unit postal code"],
  landlord: ["Landlord's address", "Landlord's street address", "Landlord's unit", "Landlord's city or town", "Landlord's province or territory", "Landlord's postal code"],
  owner: ["Owner's address", "Owner's street address", "Owner's unit", "Owner's city or town", "Owner's province or territory", "Owner's postal code"],
  business: ["Business address in Ontario", "Business street address", "Business unit", "Business city or town", "Business province", "Business postal code"],
};

/**
 * A structured Canadian address. `scope`:
 *   "canada"  street, unit, city, province, postal code
 *   "ontario" street, unit, city, postal code (province fixed to Ontario)
 *   "ottawa"  street, unit, postal code (City of Ottawa services)
 */
export const addressGroup = (role, { scope = "canada", hint, ...opts } = {}) => {
  const [heading, street, unit, city, province, postal] = ADDRESS_LABELS[role];
  const shared = meta(opts);
  const section = role === "mailing" ? "shipping" : `section-${role}`;
  return [
    info(`${role}AddressHeading`, heading, { variant: "heading", ...(hint && { hint }), ...shared }),
    text(`${role}Street`, "Street number and name", { reviewLabel: street, autoComplete: [section, "address-line1"].join(" "), full: true, placeholder: "110 Laurier Ave W", ...shared }),
    text(`${role}Unit`, "Unit, suite or apartment", { reviewLabel: unit, optional: true, autoComplete: [section, "address-line2"].join(" "), ...shared }),
    ...(scope === "ottawa" ? [] : [text(`${role}City`, "City or town", { reviewLabel: city, autoComplete: [section, "address-level2"].join(" "), ...shared })]),
    ...(scope === "canada" ? [select(`${role}Province`, "Province or territory", PROVINCE_OPTIONS, { reviewLabel: province, ...shared })] : []),
    postalCode({ name: `${role}PostalCode`, reviewLabel: postal, autoComplete: [section, "postal-code"].join(" "), ...shared }),
  ];
};

/**
 * Home address plus a mailing address that is only asked for when it differs,
 * matching the "mailing address, if different" block on federal and
 * provincial forms.
 */
export const homeAndMailing = ({ scope = "canada", homeRole = "home", sameLabel = "Is your mailing address the same as your home address?", ...opts } = {}) => [
  ...addressGroup(homeRole, { scope, ...opts }),
  radio("mailingSame", sameLabel, yesNo, meta(opts)),
  ...addressGroup("mailing", { ...opts, showIf: scoped(opts.showIf, when("mailingSame", "no")) }),
];

/* ------------------------------------------------------------------------ */
/* Direct deposit                                                           */
/* ------------------------------------------------------------------------ */

export const directDeposit = (opts = {}) => [
  info("depositHeading", "Direct deposit", { variant: "heading", hint: "Printed on a void cheque or in your bank's direct deposit form.", ...meta(opts) }),
  text("institutionNumber", "Institution number", { inputMode: "numeric", maxLength: 3, pattern: { regex: /^\d{3}$/, message: "The institution number is 3 digits." }, ...meta(opts) }),
  text("transitNumber", "Branch (transit) number", { inputMode: "numeric", maxLength: 5, pattern: { regex: /^\d{5}$/, message: "The transit number is 5 digits." }, ...meta(opts) }),
  text("accountNumber", "Account number", { inputMode: "numeric", maxLength: 12, pattern: { regex: /^\d{5,12}$/, message: "Account numbers are 5 to 12 digits." }, ...meta(opts) }),
];

/* ------------------------------------------------------------------------ */
/* Spouse or partner                                                        */
/* ------------------------------------------------------------------------ */

export const spouseDetails = ({ sin, ...opts } = {}) => [
  ...legalName({ prefix: "spouse", surnameLabel: "Spouse's or partner's surname", givenLabel: "Spouse's or partner's given name(s)", ...opts }),
  date("spouseDob", "Spouse's or partner's date of birth", { notAfterToday: true, ...meta(opts) }),
  ...(sin ? [sin] : []),
];

/* ------------------------------------------------------------------------ */
/* Declarations                                                             */
/* ------------------------------------------------------------------------ */

export const declareTrue = (opts = {}) =>
  declaration("declTrue", "I declare that the information I have given is true, correct and complete to the best of my knowledge.", {
    reviewLabel: "Declaration of truth",
    ...opts,
  });

export const consentToVerify = (label, opts = {}) => declaration("declConsent", label, { reviewLabel: "Consent", ...opts });

