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
import { getFieldKit, number, radio, when } from "../data/fieldBuilders";
import { getFormatters } from "../i18n/format";
import { byLang, tr } from "../i18n/i18n";

export const getFinderSteps = byLang((t, lang) => {
  const { money } = getFieldKit(lang);
  return [
    {
      id: "household",
      label: t("Household", "Ménage"),
      title: t("Who's in your household?", "Qui fait partie de votre ménage?"),
      description: t("We use this for family and child benefits.", "Ces renseignements servent aux prestations familiales et pour enfants."),
      fields: [
        radio("householdType", t("Your situation", "Votre situation"), [
          ["single", t("Single", "Personne seule"), t("Including separated, divorced or widowed", "Y compris séparé, divorcé ou veuf")],
          ["couple", t("Married or common-law", "Marié ou conjoint de fait")],
        ]),
        number("childrenUnder6", t("Children under 6", "Enfants de moins de 6 ans"), { max: 12 }),
        number("children6to17", t("Children aged 6 to 17", "Enfants de 6 à 17 ans"), { max: 12 }),
      ],
    },
    {
      id: "income",
      label: t("Income", "Revenu"),
      title: t("What was your family income in 2025?", "Quel était votre revenu familial en 2025?"),
      description: t(
        "Most federal benefits for July 2026 – June 2027 are based on your 2025 tax return.",
        "La plupart des prestations fédérales de juillet 2026 à juin 2027 sont fondées sur votre déclaration de revenus de 2025.",
      ),
      fields: [
        money("afni", t("Adjusted family net income (2025)", "Revenu familial net rajusté (2025)"), {
          full: true,
          hint: t(
            "Line 23600 of your return, plus your spouse's if you have one. An estimate is fine.",
            "Ligne 23600 de votre déclaration, plus celle de votre époux ou conjoint de fait, s'il y a lieu. Une estimation suffit.",
          ),
        }),
      ],
    },
    {
      id: "savings",
      label: t("Savings", "Épargne"),
      title: t("Savings and health", "Épargne et santé"),
      description: t(
        "Provincial support programs look at savings and disability.",
        "Les programmes de soutien provinciaux tiennent compte de l'épargne et de l'invalidité.",
      ),
      fields: [
        money("assets", t("Savings and investments", "Épargne et placements"), {
          full: true,
          hint: t(
            "Cash, bank accounts and investments. Leave out your home, main vehicle and RDSP.",
            "Argent comptant, comptes bancaires et placements. Excluez votre maison, votre véhicule principal et votre REEI.",
          ),
        }),
        radio("disability", t(
          "Do you have a disability or health condition expected to last a year or more?",
          "Avez-vous un handicap ou un problème de santé qui devrait durer un an ou plus?",
        ), [
          ["yes", t("Yes", "Oui")],
          ["no", t("No", "Non")],
          ["unsure", t("Not sure", "Je ne sais pas")],
        ]),
      ],
    },
    {
      id: "dental",
      label: t("Dental", "Dentaire"),
      title: t("Dental coverage", "Couverture dentaire"),
      description: t(
        "The Canadian Dental Care Plan is for people without other dental insurance.",
        "Le Régime canadien de soins dentaires s'adresse aux personnes qui n'ont pas d'autre assurance dentaire.",
      ),
      fields: [
        radio("hasDentalInsurance", t(
          "Do you have dental insurance through work, school, a pension or a private plan?",
          "Avez-vous une assurance dentaire par votre travail, votre établissement d'enseignement, un régime de retraite ou un régime privé?",
        ), [
          ["no", t("No", "Non")],
          ["yes", t("Yes", "Oui")],
        ]),
      ],
    },
    {
      id: "school",
      label: t("School", "Études"),
      title: t("Post-secondary plans", "Projets d'études postsecondaires"),
      description: t(
        "Are you (or will you be) in college or university in 2026–27?",
        "Êtes-vous (ou serez-vous) au collège ou à l'université en 2026-2027?",
      ),
      fields: [
        radio("school", t("Going to school in 2026–27?", "Aux études en 2026-2027?"), [
          ["none", t("No", "Non")],
          ["public", t("Yes — public college or university", "Oui — collège ou université publics")],
          ["private", t("Yes — private career college", "Oui — collège d'enseignement professionnel privé")],
        ]),
        money("tuition", t("Tuition for the year", "Frais de scolarité pour l'année"), { showIf: when("school", "public", "private") }),
        radio("livingSituation", t("Where will you live?", "Où habiterez-vous?"), [
          ["home", t("With parents", "Chez mes parents")],
          ["away", t("Away from home", "Hors du domicile familial")],
        ], { showIf: when("school", "public", "private") }),
      ],
    },
  ];
});

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
  { id: "ccb", serviceId: "canada-child-benefit", slot: 1 },
  { id: "cgeb", serviceId: "gst-hst-credit", slot: 2 },
  { id: "osap", serviceId: "osap", slot: 3 },
];

/**
 * @returns {{
 *   total: number,
 *   cash: Array<{ id, serviceId, label, slot, amount, detail, result }>,
 *   other: Array<{ id, serviceId, label, tone, headline, detail }>,
 * }}
 */
export function runBenefitsFinder(answers, lang = "en") {
  const t = tr(lang);
  const fmt = getFormatters(lang);
  const { kids, isCouple, osapDependency } = derive(answers);
  const [ccbProgram, cgebProgram, osapProgram] = CASH_PROGRAMS;
  const cash = [];
  const other = [];

  const ccb = calculateCCB({
    afni: answers.afni,
    childrenUnder6: answers.childrenUnder6,
    children6to17: answers.children6to17,
  }, lang);
  if (ccb?.annual > 0) {
    cash.push({ ...ccbProgram, label: t("Canada Child Benefit", "Allocation canadienne pour enfants"), amount: ccb.annual, detail: ccb.subline, result: ccb });
  }

  const cgeb = calculateGstHstCredit({ hasSpouse: isCouple, afni: answers.afni, children: kids }, lang);
  if (cgeb?.annual > 0) {
    cash.push({
      ...cgebProgram,
      label: t("Groceries & Essentials Benefit", "Allocation pour l'épicerie et les besoins essentiels"),
      amount: cgeb.annual,
      detail: cgeb.subline,
      result: cgeb,
    });
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
    }, lang);
    if (osap?.grant > 0) {
      cash.push({
        ...osapProgram,
        label: t("OSAP grant", "Bourse du RAFEO"),
        amount: osap.grant,
        detail: t("Non-repayable part of your OSAP estimate", "Partie non remboursable de votre estimation du RAFEO"),
        result: osap,
      });
    }
    if (osap?.loan > 0) {
      other.push({
        id: "osap-loan",
        serviceId: "osap",
        label: t("OSAP loan", "Prêt du RAFEO"),
        tone: "info",
        headline: t(`${fmt.currency(osap.loan)} repayable`, `${fmt.currency(osap.loan)} à rembourser`),
        detail:
          answers.school === "private"
            ? t(
                "Private career college students don't receive provincial grants from 2026–27.",
                "À compter de 2026-2027, les étudiants des collèges d'enseignement professionnel privés ne reçoivent pas de bourses provinciales.",
              )
            : t(
                "Loans must be repaid, so they aren't counted in your total.",
                "Les prêts doivent être remboursés; ils ne sont donc pas comptés dans votre total.",
              ),
      });
    }
  }

  const dental = checkDentalEligibility({
    afni: answers.afni,
    hasDentalInsurance: answers.hasDentalInsurance,
    filedTaxes: "yes",
  }, lang);
  if (dental && dental.status !== "ineligible") {
    other.push({
      id: "dental",
      serviceId: "dental-care",
      label: t("Canadian Dental Care Plan", "Régime canadien de soins dentaires"),
      tone: "good",
      headline:
        dental.copay === 0
          ? t("Coverage: no co-payment", "Couverture : aucune quote-part")
          : t(`Coverage: ${dental.copay}% co-payment`, `Couverture : quote-part de ${dental.copay} %`),
      detail: dental.subline,
    });
  }

  if (answers.disability === "yes" || answers.disability === "unsure") {
    const odsp = screenODSPAssets({ householdType: answers.householdType, dependants: kids, assets: answers.assets }, lang);
    if (odsp?.status === "eligible") {
      other.push({
        id: "odsp",
        serviceId: "odsp",
        label: t("Ontario Disability Support Program", "Programme ontarien de soutien aux personnes handicapées"),
        tone: "info",
        headline: t("Worth checking", "À vérifier"),
        detail: t(
          `Your savings are within the ODSP limit (${odsp.subline}). A disability review and income test also apply.`,
          `Votre épargne respecte le plafond du POSPH (${odsp.subline}). Un examen de l'invalidité et une évaluation du revenu s'appliquent aussi.`,
        ),
      });
    }
  }

  // Ontario Works is last-resort support; surface it for low-to-modest incomes
  // (below the Groceries & Essentials Benefit reduction threshold).
  const income = Number(answers.afni);
  if (Number.isFinite(income) && income < CGEB_PARAMETERS.reductionThreshold) {
    const ow = screenOntarioWorksAssets({ householdType: answers.householdType, dependants: kids, assets: answers.assets }, lang);
    if (ow?.status === "eligible") {
      other.push({
        id: "ontario-works",
        serviceId: "ontario-works",
        label: t("Ontario Works", "Ontario au travail"),
        tone: "info",
        headline: t("Worth checking if money is tight now", "À vérifier si l'argent manque en ce moment"),
        detail: t(
          `Your savings are within the asset limit (${ow.subline}). Eligibility depends on your current monthly income.`,
          `Votre épargne respecte le plafond d'actifs (${ow.subline}). L'admissibilité dépend de votre revenu mensuel actuel.`,
        ),
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
