/**
 * Benefit and eligibility engines.
 *
 * Every calculator returns an EstimateResult (or null when inputs are
 * incomplete) so the wizard can render any of them the same way:
 *
 *   {
 *     status:    "eligible" | "partial" | "ineligible" | "info",
 *     headline:  string            // e.g. "$4,120 / year"
 *     subline?:  string            // e.g. "≈ $343.33 per month"
 *     breakdown: [{ label, value }]
 *     notes:     string[]
 *     period?:   string            // benefit period the parameters apply to
 *     source?:   { label, url }
 *   }
 *
 * Parameters are published figures and must be updated each benefit year.
 * Figures verified against canada.ca / ontario.ca in September 2026.
 */

const money = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
});

const moneyCents = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
});

const toAmount = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
};

const toCount = (value) => {
  const amount = toAmount(value);
  return amount === null ? 0 : Math.floor(amount);
};

const round2 = (value) => Math.round(value * 100) / 100;

/* ------------------------------------------------------------------------ */
/* Canada Child Benefit (CCB)                                               */
/* ------------------------------------------------------------------------ */

export const CCB_PARAMETERS = Object.freeze({
  period: "July 2026 – June 2027 (2025 tax year)",
  maxUnder6: 8157,
  max6to17: 6883,
  firstThreshold: 38237,
  secondThreshold: 82847,
  // [rate between thresholds, rate above second threshold] by number of children
  reductionRates: {
    1: [0.07, 0.032],
    2: [0.135, 0.057],
    3: [0.19, 0.08],
    4: [0.23, 0.095],
  },
  source: {
    label: "CRA: How we calculate your CCB",
    url: "https://www.canada.ca/en/revenue-agency/services/child-family-benefits/canada-child-benefit-overview/canada-child-benefit-we-calculate-your-ccb.html",
  },
});

export function calculateCCB({ afni, childrenUnder6, children6to17 }) {
  const income = toAmount(afni);
  const under6 = toCount(childrenUnder6);
  const older = toCount(children6to17);
  const children = under6 + older;
  if (income === null || children === 0) return null;

  const p = CCB_PARAMETERS;
  const maximum = under6 * p.maxUnder6 + older * p.max6to17;
  const [rate1, rate2] = p.reductionRates[Math.min(children, 4)];

  let reduction = 0;
  if (income > p.secondThreshold) {
    reduction =
      rate1 * (p.secondThreshold - p.firstThreshold) +
      rate2 * (income - p.secondThreshold);
  } else if (income > p.firstThreshold) {
    reduction = rate1 * (income - p.firstThreshold);
  }

  const annual = Math.max(0, round2(maximum - reduction));
  const status = annual === 0 ? "ineligible" : reduction > 0 ? "partial" : "eligible";

  return {
    status,
    headline: `${money.format(annual)} / year`,
    subline: annual > 0 ? `≈ ${moneyCents.format(annual / 12)} per month` : "No payment at this income",
    breakdown: [
      { label: `Maximum for ${children} child${children > 1 ? "ren" : ""}`, value: money.format(maximum) },
      { label: "Income-based reduction", value: `− ${money.format(reduction)}` },
      { label: "Estimated annual benefit", value: money.format(annual) },
    ],
    notes: [
      `Reduction starts above ${money.format(p.firstThreshold)} of adjusted family net income.`,
      "The Child Disability Benefit (up to $3,480 per eligible child) is not included.",
    ],
    period: p.period,
    source: p.source,
  };
}

/* ------------------------------------------------------------------------ */
/* GST/HST credit — Canada Groceries and Essentials Benefit (CGEB)          */
/* The GST/HST credit was renamed and enhanced 25% from July 2026.          */
/* ------------------------------------------------------------------------ */

export const CGEB_PARAMETERS = Object.freeze({
  period: "July 2026 – June 2027 (2025 tax year)",
  individual: 445,
  spouseOrDependant: 445,
  perChild: 234,
  singleSupplementMax: 234,
  supplementPhaseInRate: 0.02,
  supplementThreshold: 11564,
  reductionThreshold: 46432,
  reductionRate: 0.05,
  source: {
    label: "CRA: CGEB payments chart",
    url: "https://www.canada.ca/en/revenue-agency/services/child-family-benefits/canada-groceries-essentials-benefit/how-much/payments-chart.html",
  },
});

export function calculateGstHstCredit({ hasSpouse, afni, children }) {
  const income = toAmount(afni);
  if (income === null || hasSpouse === undefined || hasSpouse === "") return null;

  const p = CGEB_PARAMETERS;
  const kids = toCount(children);
  const breakdown = [{ label: "Basic amount", value: money.format(p.individual) }];
  let total = p.individual;

  if (hasSpouse) {
    total += p.spouseOrDependant + kids * p.perChild;
    breakdown.push({ label: "Spouse or common-law partner", value: money.format(p.spouseOrDependant) });
    if (kids) breakdown.push({ label: `${kids} child${kids > 1 ? "ren" : ""} under 19`, value: money.format(kids * p.perChild) });
  } else if (kids > 0) {
    // Single parents claim the eligible-dependant amount for one child and
    // receive the full single supplement.
    total += p.spouseOrDependant + p.singleSupplementMax + (kids - 1) * p.perChild;
    breakdown.push({ label: "Eligible dependant (first child)", value: money.format(p.spouseOrDependant) });
    breakdown.push({ label: "Single supplement (single parent)", value: money.format(p.singleSupplementMax) });
    if (kids > 1) breakdown.push({ label: `${kids - 1} additional child${kids > 2 ? "ren" : ""}`, value: money.format((kids - 1) * p.perChild) });
  } else {
    const supplement = Math.min(
      p.singleSupplementMax,
      Math.max(0, (income - p.supplementThreshold) * p.supplementPhaseInRate),
    );
    total += supplement;
    breakdown.push({ label: "Single supplement (phased in)", value: money.format(supplement) });
  }

  const reduction = Math.max(0, (income - p.reductionThreshold) * p.reductionRate);
  const annual = Math.max(0, round2(total - reduction));
  if (reduction > 0) breakdown.push({ label: "Income-based reduction", value: `− ${money.format(reduction)}` });

  return {
    status: annual === 0 ? "ineligible" : reduction > 0 ? "partial" : "eligible",
    headline: `${money.format(annual)} / year`,
    subline: annual > 0 ? `Paid quarterly: ≈ ${moneyCents.format(annual / 4)} each` : "No payment at this income",
    breakdown,
    notes: [
      "Replaced the GST/HST credit in July 2026 with a 25% increase through 2031.",
      "You must file a 2025 tax return (and your spouse too) to be assessed.",
    ],
    period: p.period,
    source: p.source,
  };
}

/* ------------------------------------------------------------------------ */
/* OSAP (Ontario Student Assistance Program) — simplified estimator         */
/* ------------------------------------------------------------------------ */

/**
 * The real OSAP assessment uses detailed allowance tables. This model uses
 * transparent, illustrative assumptions (below) plus the published 2026–27
 * rule that grants are capped at 25% of assessed provincial aid at public
 * institutions, and private career college students receive no provincial
 * grants. Treat the output as a planning estimate only.
 */
export const OSAP_ASSUMPTIONS = Object.freeze({
  period: "2026–27 academic year",
  booksAndSupplies: 1500,
  weeklyLivingAllowance: { home: 170, away: 400 },
  parentalContribution: { exemptIncome: 70000, rate: 0.2 },
  independentContribution: { exemptIncome: 30000, rate: 0.25 },
  publicGrantShare: 0.25,
  source: {
    label: "Ontario: OSAP",
    url: "https://www.ontario.ca/page/osap-ontario-student-assistance-program",
  },
});

export function estimateOSAP({
  institutionType,
  tuition,
  livingSituation,
  dependency,
  familyIncome,
  savings,
  studyWeeks,
}) {
  const tuitionCost = toAmount(tuition);
  const income = toAmount(familyIncome);
  const weeks = toCount(studyWeeks) || 34;
  if (tuitionCost === null || income === null || !institutionType || !livingSituation || !dependency) {
    return null;
  }

  const a = OSAP_ASSUMPTIONS;
  const living = a.weeklyLivingAllowance[livingSituation === "away" ? "away" : "home"] * weeks;
  const costs = tuitionCost + a.booksAndSupplies + living;

  const rule = dependency === "dependent" ? a.parentalContribution : a.independentContribution;
  const familyContribution = Math.max(0, (income - rule.exemptIncome) * rule.rate);
  const studentContribution = toAmount(savings) ?? 0;

  const need = Math.max(0, round2(costs - familyContribution - studentContribution));
  const grantShare = institutionType === "public" ? a.publicGrantShare : 0;
  const grant = round2(need * grantShare);
  const loan = round2(need - grant);

  return {
    status: need === 0 ? "ineligible" : "eligible",
    headline: `${money.format(need)} estimated aid`,
    subline: `${money.format(grant)} grant · ${money.format(loan)} repayable loan`,
    breakdown: [
      { label: "Tuition", value: money.format(tuitionCost) },
      { label: "Books & supplies (assumed)", value: money.format(a.booksAndSupplies) },
      { label: `Living costs (${weeks} weeks)`, value: money.format(living) },
      { label: dependency === "dependent" ? "Expected parental contribution" : "Expected family contribution", value: `− ${money.format(familyContribution)}` },
      { label: "Your savings", value: `− ${money.format(studentContribution)}` },
    ],
    notes: [
      institutionType === "public"
        ? "From 2026–27, up to 25% of provincial aid is a grant; the rest is a loan."
        : "Private career college students are not eligible for provincial grants from 2026–27.",
      "Simplified model with illustrative living-cost assumptions. Your OSAP assessment is final.",
    ],
    period: a.period,
    source: a.source,
  };
}

/* ------------------------------------------------------------------------ */
/* Canadian Dental Care Plan (CDCP)                                         */
/* ------------------------------------------------------------------------ */

export const CDCP_PARAMETERS = Object.freeze({
  incomeCap: 90000,
  tiers: [
    { below: 70000, copay: 0 },
    { below: 80000, copay: 0.4 },
    { below: 90000, copay: 0.6 },
  ],
  source: {
    label: "Canada.ca: Canadian Dental Care Plan",
    url: "https://www.canada.ca/en/services/benefits/dental/dental-care-plan.html",
  },
});

export function checkDentalEligibility({ afni, hasDentalInsurance, filedTaxes }) {
  const income = toAmount(afni);
  if (income === null || !hasDentalInsurance || !filedTaxes) return null;

  const p = CDCP_PARAMETERS;
  const reasons = [];
  if (hasDentalInsurance === "yes") reasons.push("You have access to private dental insurance.");
  if (filedTaxes === "no") reasons.push("You (and your spouse) must file your latest tax return.");
  if (income >= p.incomeCap) reasons.push(`Adjusted family net income must be under ${money.format(p.incomeCap)}.`);

  if (reasons.length) {
    return {
      status: "ineligible",
      headline: "Likely not eligible",
      breakdown: [],
      notes: reasons,
      source: p.source,
    };
  }

  const tier = p.tiers.find((t) => income < t.below);
  return {
    status: tier.copay === 0 ? "eligible" : "partial",
    headline: tier.copay === 0 ? "Likely eligible — no co-payment" : `Likely eligible — ${tier.copay * 100}% co-payment`,
    subline: `CDCP covers ${100 - tier.copay * 100}% of eligible costs at CDCP fee-guide rates`,
    breakdown: [{ label: "Adjusted family net income", value: money.format(income) }],
    notes: ["Providers may charge more than the CDCP fee guide; ask before treatment."],
    source: p.source,
  };
}

/* ------------------------------------------------------------------------ */
/* ODSP / Ontario Works asset screens                                       */
/* ------------------------------------------------------------------------ */

export const ODSP_ASSET_LIMITS = Object.freeze({
  single: 40000,
  couple: 50000,
  perDependant: 500,
  source: {
    label: "ODSP policy directive 4.1",
    url: "https://www.ontario.ca/document/ontario-disability-support-program-policy-directives-income-support/41-definition-and",
  },
});

export const ONTARIO_WORKS_ASSET_LIMITS = Object.freeze({
  single: 10000,
  couple: 15000,
  perDependant: 500,
  source: {
    label: "Ontario Works policy directive 4.2",
    url: "https://www.ontario.ca/document/ontario-works-policy-directives/42-asset-limits",
  },
});

const screenAssets = (limits, programName, { householdType, dependants, assets }) => {
  const total = toAmount(assets);
  if (total === null || !householdType) return null;

  const deps = toCount(dependants);
  const limit = (householdType === "couple" ? limits.couple : limits.single) + deps * limits.perDependant;
  const within = total <= limit;

  return {
    status: within ? "eligible" : "ineligible",
    headline: within ? "Within the asset limit" : "Over the asset limit",
    subline: `${money.format(total)} of ${money.format(limit)} allowed`,
    breakdown: [
      { label: householdType === "couple" ? "Couple limit" : "Single limit", value: money.format(householdType === "couple" ? limits.couple : limits.single) },
      { label: `${deps} dependant${deps === 1 ? "" : "s"} × ${money.format(limits.perDependant)}`, value: money.format(deps * limits.perDependant) },
      { label: "Your non-exempt assets", value: money.format(total) },
    ],
    notes: [
      "Your principal home, a primary vehicle and RDSP savings are generally exempt.",
      `This is a preliminary asset screen. ${programName} also assesses income and other criteria.`,
    ],
    source: limits.source,
  };
};

export const screenODSPAssets = (input) => screenAssets(ODSP_ASSET_LIMITS, "ODSP", input);
export const screenOntarioWorksAssets = (input) =>
  screenAssets(ONTARIO_WORKS_ASSET_LIMITS, "Ontario Works", input);

/* ------------------------------------------------------------------------ */
/* Old Age Security residence share                                         */
/* ------------------------------------------------------------------------ */

export function estimateOasResidence({ yearsInCanadaAfter18 }) {
  const years = toAmount(yearsInCanadaAfter18);
  if (years === null) return null;

  const counted = Math.min(40, Math.floor(years));
  if (counted < 10) {
    return {
      status: "ineligible",
      headline: "Not yet eligible for OAS",
      subline: "OAS requires at least 10 years in Canada after age 18",
      breakdown: [{ label: "Years counted", value: `${counted} of 40` }],
      notes: ["Social security agreements with other countries may help you qualify."],
    };
  }

  return {
    status: counted === 40 ? "eligible" : "partial",
    headline: counted === 40 ? "Full OAS pension" : `Partial OAS: ${counted}/40ths`,
    subline: `${Math.round((counted / 40) * 100)}% of the full OAS pension`,
    breakdown: [{ label: "Years counted", value: `${counted} of 40` }],
    notes: ["CPP is based on your contributions; get your statement in My Service Canada Account."],
    source: {
      label: "Canada.ca: OAS eligibility",
      url: "https://www.canada.ca/en/services/benefits/publicpensions/old-age-security/eligibility.html",
    },
  };
}
