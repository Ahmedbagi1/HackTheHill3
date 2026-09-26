/**
 * "Money you might be missing" finder.
 *
 * Five questions feed every existing calculator. Only non-repayable cash is
 * added to the headline total (CCB, Groceries & Essentials Benefit, OSAP
 * grant). Coverage (dental) and last-resort support (ODSP, Ontario Works)
 * are listed separately because they aren't comparable yearly cash amounts.
 */

import {
  CGEB_PARAMETERS,
  calculateCCB,
  calculateGstHstCredit,
  checkDentalEligibility,
  estimateOSAP,
  screenODSPAssets,
  screenOntarioWorksAssets,
} from "../services/api/benefitCalculators";
import { money, number, radio, when } from "../data/fieldBuilders";

export const FINDER_STEPS = [
  {
    id: "household",
    label: "Household",
    title: "Who's in your household?",
    description: "We use this for family and child benefits.",
    fields: [
      radio("householdType", "Your situation", [
        ["single", "Single", "Including separated, divorced or widowed"],
        ["couple", "Married or common-law"],
      ]),
      number("childrenUnder6", "Children under 6", { max: 12 }),
      number("children6to17", "Children aged 6 to 17", { max: 12 }),
    ],
  },
  {
    id: "income",
    label: "Income",
    title: "What was your family income in 2025?",
    description: "Most federal benefits for July 2026 – June 2027 are based on your 2025 tax return.",
    fields: [
      money("afni", "Adjusted family net income (2025)", {
        full: true,
        hint: "Line 23600 of your return, plus your spouse's if you have one. An estimate is fine.",
      }),
    ],
  },
  {
    id: "savings",
    label: "Savings",
    title: "Savings and health",
    description: "Provincial support programs look at savings and disability.",
    fields: [
      money("assets", "Savings and investments", {
        full: true,
        hint: "Cash, bank accounts and investments. Leave out your home, main vehicle and RDSP.",
      }),
      radio("disability", "Do you have a disability or health condition expected to last a year or more?", [
        ["yes", "Yes"],
        ["no", "No"],
        ["unsure", "Not sure"],
      ]),
    ],
  },
  {
    id: "dental",
    label: "Dental",
    title: "Dental coverage",
    description: "The Canadian Dental Care Plan is for people without other dental insurance.",
    fields: [
      radio("hasDentalInsurance", "Do you have dental insurance through work, school, a pension or a private plan?", [
        ["no", "No"],
        ["yes", "Yes"],
      ]),
    ],
  },
  {
    id: "school",
    label: "School",
    title: "Post-secondary plans",
    description: "Are you (or will you be) in college or university in 2026–27?",
    fields: [
      radio("school", "Going to school in 2026–27?", [
        ["none", "No"],
        ["public", "Yes — public college or university"],
        ["private", "Yes — private career college"],
      ]),
      money("tuition", "Tuition for the year", { showIf: when("school", "public", "private") }),
      radio("livingSituation", "Where will you live?", [
        ["home", "With parents"],
        ["away", "Away from home"],
      ], { showIf: when("school", "public", "private") }),
    ],
  },
];

export const INITIAL_FINDER_ANSWERS = {
  householdType: "",
  childrenUnder6: "0",
  children6to17: "0",
  afni: "",
  assets: "",
  disability: "",
  hasDentalInsurance: "",
  school: "",
  tuition: "",
  livingSituation: "",
};

const toInt = (value) => Math.max(0, Math.floor(Number(value) || 0));

const derive = (answers) => {
  const kids = toInt(answers.childrenUnder6) + toInt(answers.children6to17);
  return {
    kids,
    isCouple: answers.householdType === "couple",
    // OSAP treats married students and parents as independent.
    osapDependency: answers.householdType === "couple" || kids > 0 ? "independent" : "dependent",
  };
};

/** Fixed series order: colour follows the program, never its rank. */
export const CASH_PROGRAMS = [
  { id: "ccb", serviceId: "canada-child-benefit", label: "Canada Child Benefit", slot: 1 },
  { id: "cgeb", serviceId: "gst-hst-credit", label: "Groceries & Essentials Benefit", slot: 2 },
  { id: "osap", serviceId: "osap", label: "OSAP grant", slot: 3 },
];

/**
 * @returns {{
 *   total: number,
 *   cash: Array<{ id, serviceId, label, slot, amount, detail, result }>,
 *   other: Array<{ id, serviceId, label, tone, headline, detail }>,
 * }}
 */
export function runBenefitsFinder(answers) {
  const { kids, isCouple, osapDependency } = derive(answers);
  const cash = [];
  const other = [];

  const ccb = calculateCCB({
    afni: answers.afni,
    childrenUnder6: answers.childrenUnder6,
    children6to17: answers.children6to17,
  });
  if (ccb?.annual > 0) {
    cash.push({ ...CASH_PROGRAMS[0], amount: ccb.annual, detail: ccb.subline, result: ccb });
  }

  const cgeb = calculateGstHstCredit({ hasSpouse: isCouple, afni: answers.afni, children: kids });
  if (cgeb?.annual > 0) {
    cash.push({ ...CASH_PROGRAMS[1], amount: cgeb.annual, detail: cgeb.subline, result: cgeb });
  }

  if (answers.school === "public" || answers.school === "private") {
    const osap = estimateOSAP({
      institutionType: answers.school,
      tuition: answers.tuition,
      livingSituation: answers.livingSituation,
      dependency: osapDependency,
      familyIncome: answers.afni,
      savings: 0,
      studyWeeks: 34,
    });
    if (osap?.grant > 0) {
      cash.push({ ...CASH_PROGRAMS[2], amount: osap.grant, detail: "Non-repayable part of your OSAP estimate", result: osap });
    }
    if (osap?.loan > 0) {
      other.push({
        id: "osap-loan",
        serviceId: "osap",
        label: "OSAP loan",
        tone: "info",
        headline: `${new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(osap.loan)} repayable`,
        detail:
          answers.school === "private"
            ? "Private career college students don't receive provincial grants from 2026–27."
            : "Loans must be repaid, so they aren't counted in your total.",
      });
    }
  }

  const dental = checkDentalEligibility({
    afni: answers.afni,
    hasDentalInsurance: answers.hasDentalInsurance,
    filedTaxes: "yes",
  });
  if (dental && dental.status !== "ineligible") {
    other.push({
      id: "dental",
      serviceId: "dental-care",
      label: "Canadian Dental Care Plan",
      tone: "good",
      headline: dental.headline.replace("Likely eligible — ", "Coverage: "),
      detail: dental.subline,
    });
  }

  if (answers.disability === "yes" || answers.disability === "unsure") {
    const odsp = screenODSPAssets({ householdType: answers.householdType, dependants: kids, assets: answers.assets });
    if (odsp?.status === "eligible") {
      other.push({
        id: "odsp",
        serviceId: "odsp",
        label: "Ontario Disability Support Program",
        tone: "info",
        headline: "Worth checking",
        detail: `Your savings are within the ODSP limit (${odsp.subline}). A disability review and income test also apply.`,
      });
    }
  }

  // Ontario Works is last-resort support; surface it for low-to-modest incomes
  // (below the Groceries & Essentials Benefit reduction threshold).
  const income = Number(answers.afni);
  if (Number.isFinite(income) && income < CGEB_PARAMETERS.reductionThreshold) {
    const ow = screenOntarioWorksAssets({ householdType: answers.householdType, dependants: kids, assets: answers.assets });
    if (ow?.status === "eligible") {
      other.push({
        id: "ontario-works",
        serviceId: "ontario-works",
        label: "Ontario Works",
        tone: "info",
        headline: "Worth checking if money is tight now",
        detail: `Your savings are within the asset limit (${ow.subline}). Eligibility depends on your current monthly income.`,
      });
    }
  }

  const total = Math.round(cash.reduce((sum, item) => sum + item.amount, 0));
  return { total, cash, other };
}

/** Maps finder answers onto a service's wizard fields so "Apply" opens prefilled. */
export function prefillFor(serviceId, answers) {
  const { kids, osapDependency } = derive(answers);
  switch (serviceId) {
    case "canada-child-benefit":
      return { afni: answers.afni, childrenUnder6: answers.childrenUnder6, children6to17: answers.children6to17 };
    case "gst-hst-credit":
      return { maritalStatus: answers.householdType, afni: answers.afni, children: String(kids) };
    case "dental-care":
      return { afni: answers.afni, hasDentalInsurance: answers.hasDentalInsurance };
    case "osap":
      return {
        institutionType: answers.school,
        tuition: answers.tuition,
        livingSituation: answers.livingSituation,
        dependency: osapDependency,
        familyIncome: answers.afni,
      };
    case "odsp":
    case "ontario-works":
      return { householdType: answers.householdType, dependants: String(kids), assets: answers.assets };
    default:
      return {};
  }
}
