import { useState, type ReactNode } from "react";
import { CircleCheck, CircleX, ExternalLink, FileCheck2, House, Phone, RotateCcw, ShieldAlert, TriangleAlert } from "lucide-react";
import { checks, money, number, radio, select } from "../../data/fieldBuilders";
import { useCivicData } from "../../state/civicDataStore";
import { useI18n } from "../../i18n/i18nContext";
import Tx from "../../i18n/Tx";
import { DemoTag, Notice, Pill, SectionCard } from "../../components/ui/primitives";
import ModuleShell from "../shared/ModuleShell";
import IntakeStepper, { type IntakeStep } from "../shared/IntakeStepper";
import { evaluateHousingEligibility } from "./housingEligibility";
import { REGIONAL_MARKETS } from "./housingRules";
import type { HousingEligibilityResult, HousingIntake } from "../../types/housing";

const yesNo = [
  ["yes", "Yes"],
  ["no", "No"],
];

const STEPS: IntakeStep[] = [
  {
    id: "household",
    label: "Household",
    title: "Who would live with you?",
    description: "Unit size and income limits depend on your household.",
    fields: [
      radio("serviceArea", "Where are you applying?", [
        ["ottawa", "City of Ottawa"],
        ["other", "Elsewhere in Ontario"],
      ]),
      number("applicantAge", "Your age", { max: 120 }),
      radio("hasSpouse", "Do you have a spouse or partner who would live with you?", yesNo),
      number("children", "Children in the household", { max: 12 }),
      number("otherAdults", "Other adults (not your spouse)", { max: 12 }),
    ],
  },
  {
    id: "finances",
    label: "Income & status",
    title: "Income, assets and status",
    description: "Use your household's combined figures from your latest tax returns.",
    fields: [
      money("annualIncome", "Combined household income (before tax)", { full: true, hint: "From each member's Notice of Assessment." }),
      money("assets", "Household assets", {
        full: true,
        hint: "Cash, bank accounts, investments and property. Don't include a vehicle, RRSPs, RESPs or RDSPs.",
      }),
      money("currentMonthlyRent", "Current monthly rent", { optional: true, hint: "Leave blank if you don't pay rent." }),
      select("statusInCanada", "Status in Canada", [
        ["citizen", "Canadian citizen"],
        ["permanent-resident", "Permanent resident"],
        ["refugee", "Convention refugee"],
        ["refugee-claimant", "Refugee claimant"],
        ["other", "Other (e.g. visitor, student or work permit)"],
      ]),
      radio("arrears", "Do you owe money to a social housing provider in Ontario?", [
        ["none", "No"],
        ["repayment-agreement", "Yes, with a repayment agreement"],
        ["outstanding", "Yes, no agreement"],
      ]),
      radio("ownsResidentialProperty", "Does anyone in the household own a home?", yesNo),
    ],
  },
  {
    id: "needs",
    label: "Priority & needs",
    title: "Safety, health and housing situation",
    description: "These determine your place in the selection order. Answer only what applies.",
    fields: [
      checks(
        "priorityFlags",
        "Do any of these apply?",
        [
          ["specialProvincialPriority", "Leaving abuse or human trafficking", "Special Provincial Priority"],
          ["urgentSafety", "Facing an ongoing, extraordinary threat to safety", "Local priority: urgent safety"],
          ["lifeThreateningMedical", "Life-threatening condition made worse by my housing", "Local priority: medical"],
          ["homeless", "Living in a shelter or without a home", "Local priority: homeless"],
          ["overHoused", "I live in an RGI unit bigger than I need", "Provincial over-housed priority"],
        ],
        { optional: true },
      ),
      radio("livesIndependently", "Can you live independently, arranging any support you need?", yesNo),
      radio("accessibilityNeeds", "Does anyone need an accessible unit?", yesNo),
    ],
  },
];

const INITIAL: Record<string, unknown> = {
  serviceArea: "",
  applicantAge: "",
  hasSpouse: "",
  children: "0",
  otherAdults: "0",
  annualIncome: "",
  assets: "",
  currentMonthlyRent: "",
  statusInCanada: "",
  arrears: "",
  ownsResidentialProperty: "",
  priorityFlags: [],
  livesIndependently: "",
  accessibilityNeeds: "",
};

function toIntake(v: Record<string, unknown>): HousingIntake {
  const flags = (v.priorityFlags as string[]) ?? [];
  const num = (key: string) => Number(v[key]) || 0;
  return {
    serviceArea: v.serviceArea === "ottawa" ? "ottawa" : "other",
    applicantAge: num("applicantAge"),
    hasSpouse: v.hasSpouse === "yes",
    children: num("children"),
    otherAdults: num("otherAdults"),
    annualIncome: num("annualIncome"),
    assets: num("assets"),
    currentMonthlyRent: v.currentMonthlyRent === "" ? null : num("currentMonthlyRent"),
    statusInCanada: v.statusInCanada as HousingIntake["statusInCanada"],
    arrears: v.arrears as HousingIntake["arrears"],
    ownsResidentialProperty: v.ownsResidentialProperty === "yes",
    livesIndependently: v.livesIndependently === "yes",
    accessibilityNeeds: v.accessibilityNeeds === "yes",
    priority: {
      specialProvincialPriority: flags.includes("specialProvincialPriority"),
      overHoused: flags.includes("overHoused"),
      urgentSafety: flags.includes("urgentSafety"),
      lifeThreateningMedical: flags.includes("lifeThreateningMedical"),
      homeless: flags.includes("homeless"),
    },
  };
}

const STATUS_COPY: Record<HousingEligibilityResult["status"], { title: string; tone: "success" | "warning" | "danger" | "info" }> = {
  eligible: { title: "You appear eligible for rent-geared-to-income housing", tone: "success" },
  "needs-review": { title: "You may be eligible; some answers need review", tone: "warning" },
  ineligible: { title: "You don't appear eligible for RGI assistance", tone: "danger" },
  "unsupported-area": { title: "We don't have income limits for your area yet", tone: "info" },
};

function IncomeMeter({ income, limit }: { income: number; limit: number }) {
  const { t, formatMoney } = useI18n();
  const pct = Math.min(100, (income / limit) * 100);
  return (
    <div className="meter" role="img" aria-label={t("Income {income} of {limit} limit", { income: formatMoney(income), limit: formatMoney(limit) })}>
      <div className="meter__track">
        <span className={`meter__fill${income >= limit ? " meter__fill--over" : ""}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="meter__labels">
        <span>{t("{amount} household income", { amount: formatMoney(income) })}</span>
        <span>{t("Limit {amount}", { amount: formatMoney(limit) })}</span>
      </div>
    </div>
  );
}

function EligibilityResult({ result, intake }: { result: HousingEligibilityResult; intake: HousingIntake }) {
  const { t, formatMoney } = useI18n();
  const copy = STATUS_COPY[result.status];
  return (
    <>
      <Notice tone={copy.tone}>
        <strong>{t(copy.title)}.</strong>{" "}
        {result.status === "eligible" || result.status === "needs-review"
          ? t("Apply through The Social Housing Registry of Ottawa; CivicOS tracks your documents and progress.")
          : result.status === "ineligible"
            ? t("See the reasons below and other options that may fit.")
            : t("Contact your local housing service manager.")}
      </Notice>

      {result.incomeLimit !== null && <IncomeMeter income={intake.annualIncome} limit={result.incomeLimit} />}

      <dl className="facts">
        <div>
          <dt>{t("Household size")}</dt>
          <dd>{result.householdSize}</dd>
        </div>
        <div>
          <dt>{t("Largest eligible unit")}</dt>
          <dd>{t("{count} bedroom", { count: result.bedroomsEligible === 4 ? "4+" : String(result.bedroomsEligible) })}</dd>
        </div>
        <div>
          <dt>{t("Estimated RGI rent")}</dt>
          <dd>
            {formatMoney(result.estimatedRgiRent)}
            <small>{t("/month (30% of income)")}</small>
          </dd>
        </div>
        <div>
          <dt>{t("Selection priority")}</dt>
          <dd>
            {t(result.priority.label)}
            <small>{t("Rank {rank} of 4", { rank: result.priority.rank })}</small>
          </dd>
        </div>
      </dl>

      {result.affordability.tier !== "unknown" && (
        <p className={`affordability affordability--${result.affordability.tier}`}>
          <TriangleAlert size={14} aria-hidden="true" /> {t(result.affordability.label)}
          {result.affordability.rentShare !== null && Number.isFinite(result.affordability.rentShare) && (
            <> · {t("{percent}% of income today", { percent: Math.round(result.affordability.rentShare * 100) })}</>
          )}
        </p>
      )}

      <h3 className="subhead">{t("Eligibility checks")}</h3>
      <ul className="checks">
        {result.checks.map((check) => (
          <li key={check.id} className={`check check--${check.status}`}>
            {check.status === "pass" ? (
              <CircleCheck size={16} aria-hidden="true" />
            ) : check.status === "fail" ? (
              <CircleX size={16} aria-hidden="true" />
            ) : (
              <TriangleAlert size={16} aria-hidden="true" />
            )}
            <div>
              <p className="check__label">
                {t(check.label)} <span className="sr-only">{t(check.status === "pass" ? "passed" : check.status === "fail" ? "failed" : "needs review")}</span>
              </p>
              <Tx as="p" className="check__detail" text={check.detail} />
            </div>
          </li>
        ))}
      </ul>
      <Tx as="p" className="fineprint" text={result.priority.explanation} />

      {result.alternatives.length > 0 && (
        <>
          <h3 className="subhead">{t("Other options")}</h3>
          <ul className="bullets">
            {result.alternatives.map((a) => (
              <Tx key={a} as="li" text={a} />
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function DocumentsChecklist({
  documents,
  ready,
  onToggle,
}: {
  documents: HousingEligibilityResult["documents"];
  ready: string[];
  onToggle: (id: string) => void;
}) {
  const { t } = useI18n();
  const required = documents.filter((d) => d.required);
  const done = required.filter((d) => ready.includes(d.id)).length;
  return (
    <SectionCard
      id="housing-docs"
      title={t("Document checklist")}
      icon={<FileCheck2 size={16} />}
      actions={<Pill tone={done === required.length ? "success" : "warning"}>{t("{done}/{total} ready", { done, total: required.length })}</Pill>}
    >
      <ul className="doclist">
        {documents.map((doc) => {
          const checked = ready.includes(doc.id);
          return (
            <li key={doc.id}>
              <label className={`doc${checked ? " doc--ready" : ""}`}>
                <input type="checkbox" checked={checked} onChange={() => onToggle(doc.id)} />
                <span>
                  <span className="doc__label">
                    {t(doc.label)} {!doc.required && <span className="field__optional">({t("if applicable")})</span>}
                  </span>
                  <Tx className="doc__detail" text={doc.detail} />
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <p className="fineprint">{t("Keep documents ready: when you're offered a unit you'll need to provide them quickly, and you're guaranteed one offer.")}</p>
    </SectionCard>
  );
}

const RegistryCard = () => {
  const { t } = useI18n();
  const registry = REGIONAL_MARKETS.ottawa.registry;
  return (
    <SectionCard id="registry" title={t("Where to apply")} icon={<House size={16} />}>
      <p className="aside-text">
        <strong>{t(registry.name)}</strong>{" "}
        {t("manages Ottawa's centralized waiting list. The only way to receive RGI assistance is to apply with them.")}
      </p>
      <p className="aside-links">
        <a href={registry.url} target="_blank" rel="noreferrer">
          housingregistry.ca <ExternalLink size={11} aria-hidden="true" />
        </a>
        <a href={`tel:${registry.phone.replace(/\D/g, "")}`}>
          <Phone size={12} aria-hidden="true" /> {registry.phone}
        </a>
      </p>
      <p className="fineprint">
        {t("Income limits effective {date}. Keep in touch with the Registry at least once a year or your application may be cancelled.", {
          date: t(REGIONAL_MARKETS.ottawa.effective),
        })}
      </p>
    </SectionCard>
  );
};

export default function HousingModule({ onBack }: { onBack: () => void }) {
  const { data, requests, saveHousing, toggleHousingDocument, withdrawRequest } = useCivicData();
  const { t, formatDate } = useI18n();
  const record = data.housing;
  const request = requests.find((r) => r.id === record?.requestId);

  const [values, setValues] = useState<Record<string, unknown>>(INITIAL);
  const [preview, setPreview] = useState<{ intake: HousingIntake; result: HousingEligibilityResult } | null>(null);
  const [previewReady, setPreviewReady] = useState<string[]>([]);

  const shell = (children: ReactNode) => (
    <ModuleShell
      eyebrow="Provincial housing assistance · Ontario"
      title="Subsidized housing (RGI)"
      lede="See whether you qualify for rent-geared-to-income housing, where you'd sit in the selection order, and what to prepare."
      icon={<House size={22} />}
      tone="housing"
      onBack={onBack}
      aside={<RegistryCard />}
    >
      {children}
    </ModuleShell>
  );

  if (record && request) {
    return shell(
      <>
        <SectionCard
          id="housing-status"
          title={
            <>
              {t("Your application")} {request.demo && <DemoTag />}
            </>
          }
          icon={<ShieldAlert size={16} />}
          actions={
            <button
              type="button"
              className="link-btn link-btn--muted"
              onClick={() => {
                if (window.confirm(t("Withdraw this application and start a new assessment?"))) withdrawRequest(record.requestId);
              }}
            >
              <RotateCcw size={13} aria-hidden="true" /> {t("Start over")}
            </button>
          }
        >
          <p className="mono ref-line">
            {request.referenceId} · {t("Submitted {date}", { date: formatDate(record.submittedAt) })}
          </p>
          <ol className="timeline timeline--horizontal">
            {request.stages.map((stage) => (
              <li key={stage.key} className={`timeline__item timeline__item--${stage.state}`}>
                <span className="timeline__dot" aria-hidden="true" />
                <div>
                  <p className="timeline__label">{t(stage.label)}</p>
                  <p className="timeline__meta">
                    {stage.state === "blocked" ? t("Waiting on documents") : stage.state === "current" ? t("In progress") : stage.date ? formatDate(stage.date) : ""}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          {request.actionRequired && (
            <Notice tone="warning">
              <strong>{t(request.actionRequired.label)}:</strong> {t(request.actionRequired.detail)}. {t("Check them off below as you gather them.")}
            </Notice>
          )}
          <EligibilityResult result={record.result} intake={record.intake} />
        </SectionCard>
        <DocumentsChecklist documents={record.result.documents} ready={record.documentsReady} onToggle={toggleHousingDocument} />
      </>,
    );
  }

  if (preview) {
    const canApply = preview.result.status === "eligible" || preview.result.status === "needs-review";
    return shell(
      <>
        <SectionCard id="housing-result" title={t("Your eligibility result")} icon={<ShieldAlert size={16} />}>
          <EligibilityResult result={preview.result} intake={preview.intake} />
          <div className="result-actions">
            <button type="button" className="btn btn--secondary" onClick={() => setPreview(null)}>
              {t("Edit answers")}
            </button>
            {canApply && (
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => saveHousing({ intake: preview.intake, result: preview.result, documentsReady: previewReady })}
              >
                {t("Track my application")}
              </button>
            )}
          </div>
        </SectionCard>
        {canApply && (
          <DocumentsChecklist
            documents={preview.result.documents}
            ready={previewReady}
            onToggle={(id) => setPreviewReady((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]))}
          />
        )}
      </>,
    );
  }

  return shell(
    <IntakeStepper
      steps={STEPS}
      values={values}
      onChange={(name, value) => setValues((prev) => ({ ...prev, [name]: value }))}
      submitLabel="Check eligibility"
      onComplete={() => {
        const intake = toIntake(values);
        setPreview({ intake, result: evaluateHousingEligibility(intake) });
      }}
    />,
  );
}

