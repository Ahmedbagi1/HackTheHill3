import { useState, type FormEvent, type ReactNode } from "react";
import {
  BadgeCheck,
  Baby,
  CircleCheck,
  CircleDashed,
  CircleMinus,
  ExternalLink,
  HandHeart,
  ListChecks,
  Plus,
  Receipt,
  RotateCcw,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import { date, radio, select, text, when } from "../../data/fieldBuilders";
import { useCivicData } from "../../state/civicDataStore";
import { useI18n } from "../../i18n/i18nContext";
import Tx from "../../i18n/Tx";
import { DemoTag, Notice, Pill, SectionCard } from "../../components/ui/primitives";
import ModuleShell from "../shared/ModuleShell";
import IntakeStepper, { type IntakeStep } from "../shared/IntakeStepper";
import { summarizeClaims, triageAutismIntake } from "./autismTriage";
import { ACCESS_OAP_URL, PEER_RESOURCES, PROVIDERS, THERAPY_LABELS } from "./oapRules";
import type {
  AutismIntake,
  AutismTriageResult,
  ClaimStatus,
  DevelopmentalDomain,
  DomainSeverity,
  FundingClaim,
  ProgramPathway,
  SupportNeedsLevel,
  TherapyType,
} from "../../types/autism";

const yesNo = [
  ["yes", "Yes"],
  ["no", "No"],
];

const DOMAINS: Array<{ id: DevelopmentalDomain; label: string; hint: string }> = [
  { id: "communication", label: "Communication", hint: "Speech, understanding, gestures" },
  { id: "social", label: "Social interaction", hint: "Play, eye contact, relationships" },
  { id: "behaviour", label: "Behaviour & regulation", hint: "Meltdowns, routines, safety" },
  { id: "sensory", label: "Sensory", hint: "Sounds, textures, light" },
  { id: "motor", label: "Motor skills", hint: "Coordination, fine motor" },
  { id: "daily-living", label: "Daily living", hint: "Eating, sleep, toileting, dressing" },
  { id: "learning", label: "Learning", hint: "Attention, new skills" },
];

const SEVERITIES: Array<{ value: DomainSeverity | "none"; label: string }> = [
  { value: "none", label: "No concern" },
  { value: "mild", label: "Some" },
  { value: "moderate", label: "Moderate" },
  { value: "significant", label: "Significant" },
];

const LEVEL_LABELS: Record<SupportNeedsLevel, string> = {
  limited: "Limited",
  moderate: "Moderate",
  "moderate-plus": "Moderate+",
  extensive: "Extensive",
};

const BAND_LABELS = { "up-to-3": "Up to age 3", "4-9": "Ages 4–9", "10-14": "Ages 10–14", "15-17": "Ages 15–17" } as const;

const INITIAL: Record<string, unknown> = {
  childFirstName: "",
  dateOfBirth: "",
  livesInOntario: "",
  diagnosisStatus: "",
  hasWrittenDiagnosis: "",
  registeredWithOap: "",
  schoolStage: "",
  languageAtHome: "",
  urgentSafetyConcern: "",
};

function toIntake(v: Record<string, unknown>, domains: Partial<Record<DevelopmentalDomain, DomainSeverity>>): AutismIntake {
  const diagnosed = v.diagnosisStatus === "diagnosed";
  return {
    childFirstName: String(v.childFirstName).trim(),
    dateOfBirth: String(v.dateOfBirth),
    livesInOntario: v.livesInOntario === "yes",
    diagnosisStatus: v.diagnosisStatus as AutismIntake["diagnosisStatus"],
    hasWrittenDiagnosis: diagnosed && v.hasWrittenDiagnosis === "yes",
    registeredWithOap: diagnosed && v.registeredWithOap === "yes",
    domains,
    urgentSafetyConcern: v.urgentSafetyConcern === "yes",
    schoolStage: v.schoolStage as AutismIntake["schoolStage"],
    languageAtHome: String(v.languageAtHome),
  };
}

const STATUS_PILL: Record<ProgramPathway["status"], { tone: "info" | "success" | "neutral"; label: string }> = {
  recommended: { tone: "info", label: "Next step" },
  eligible: { tone: "success", label: "Eligible" },
  "not-yet": { tone: "neutral", label: "Not yet" },
  "not-eligible": { tone: "neutral", label: "Not applicable" },
};

function DomainMatrix({
  value,
  onChange,
}: {
  value: Partial<Record<DevelopmentalDomain, DomainSeverity>>;
  onChange: (domain: DevelopmentalDomain, severity: DomainSeverity | "none") => void;
}) {
  const { t } = useI18n();
  return (
    <fieldset className="matrix">
      <legend className="field__label">{t("How much support does your child need in each area?")}</legend>
      <div className="matrix__head" aria-hidden="true">
        <span />
        {SEVERITIES.map((s) => (
          <span key={s.value}>{t(s.label)}</span>
        ))}
      </div>
      {DOMAINS.map((d) => (
        <div key={d.id} className="matrix__row" role="radiogroup" aria-label={t(d.label)}>
          <span className="matrix__label">
            {t(d.label)}
            <small>{t(d.hint)}</small>
          </span>
          {SEVERITIES.map((s) => {
            const checked = (value[d.id] ?? "none") === s.value;
            return (
              <label key={s.value} className={`matrix__cell${checked ? " is-checked" : ""}`}>
                <input type="radio" name={`domain-${d.id}`} checked={checked} onChange={() => onChange(d.id, s.value)} />
                <span className="matrix__cell-label">{t(s.label)}</span>
              </label>
            );
          })}
        </div>
      ))}
    </fieldset>
  );
}

function TriageResult({ triage, intake }: { triage: AutismTriageResult; intake: AutismIntake }) {
  const { t, tp, formatMoney } = useI18n();
  return (
    <>
      {triage.urgency === "urgent" ? (
        <Notice tone="danger">
          <strong>{t("Urgent.")}</strong>{" "}
          {t("Tell AccessOAP this is urgent so you're connected to urgent response services. If anyone is in immediate danger, call 9-1-1.")}
        </Notice>
      ) : triage.urgency === "priority" ? (
        <Notice tone="info">
          <strong>{t("Act soon.")}</strong>{" "}
          {triage.ageMonths <= 48 ? t("Early support makes the biggest difference at your child's age.") : t("Early support makes the biggest difference.")}
        </Notice>
      ) : null}

      <dl className="facts">
        <div>
          <dt>{t("Child")}</dt>
          <dd>
            {intake.childFirstName}
            <small>
              {triage.ageYears >= 2
                ? tp("{count} year old", "{count} years old", triage.ageYears)
                : tp("{count} month old", "{count} months old", triage.ageMonths)}
            </small>
          </dd>
        </div>
        <div>
          <dt>{t("OAP registration")}</dt>
          <dd>{t(triage.oapEligible ? (intake.registeredWithOap ? "Registered" : "Can register now") : "Not yet")}</dd>
        </div>
        <div>
          <dt>{t("Indicative support level")}</dt>
          <dd>{t(triage.funding ? LEVEL_LABELS[triage.funding.level] : "After diagnosis")}</dd>
        </div>
      </dl>

      {triage.eligibilityGaps.length > 0 && (
        <Notice tone="warning">
          <strong>{t("Before registering:")}</strong> {triage.eligibilityGaps.map((gap) => t(gap)).join(" ")}
        </Notice>
      )}

      <h3 className="subhead">{t("Program pathways")}</h3>
      <ul className="pathways">
        {triage.pathways.map((p) => (
          <li key={p.id} className={`pathway pathway--${p.status}`}>
            <div className="pathway__head">
              <p className="pathway__name">{t(p.name)}</p>
              <Pill tone={STATUS_PILL[p.status].tone}>{t(STATUS_PILL[p.status].label)}</Pill>
            </div>
            <Tx as="p" className="pathway__desc" text={p.description} />
            <p className="pathway__reason">
              <Tx text={p.reason} /> <strong>{p.status === "recommended" || p.status === "eligible" ? <Tx text={p.nextStep} /> : ""}</strong>
            </p>
          </li>
        ))}
      </ul>

      {triage.therapies.length > 0 && (
        <>
          <h3 className="subhead">{t("Therapies that match these needs")}</h3>
          <ul className="therapies">
            {triage.therapies.map((match) => (
              <li key={match.therapy}>
                <strong>{t(match.label)}</strong>
                <span>
                  {t("for {areas}", {
                    areas: match.because.map((d) => t(DOMAINS.find((x) => x.id === d)?.label ?? d).toLowerCase()).join(", "),
                  })}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {triage.funding && (
        <>
          <h3 className="subhead">{t("Indicative core clinical funding")}</h3>
          <div className="funding">
            <p className="funding__amount">
              {formatMoney(triage.funding.annualAmount)}
              <span>{t("/year")}</span>
            </p>
            <p className="funding__meta">
              {t(BAND_LABELS[triage.funding.ageBand])} · {t("{level} needs", { level: t(LEVEL_LABELS[triage.funding.level]) })} ·{" "}
              {triage.funding.installments === 1
                ? t("single payment")
                : t("{count} installments of up to {amount}", { count: triage.funding.installments, amount: formatMoney(25000) })}
            </p>
            <table className="band-table">
              <caption className="sr-only">{t("Funding by support level for {band}", { band: t(BAND_LABELS[triage.funding.ageBand]) })}</caption>
              <tbody>
                {triage.funding.bandTable.map((row) => (
                  <tr key={row.level} className={row.level === triage.funding!.level ? "is-current" : ""}>
                    <th scope="row">{t(LEVEL_LABELS[row.level])}</th>
                    <td>{formatMoney(row.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="fineprint">
              {t(
                "Amounts are Ontario's published 2026 core clinical funding by age band (age on January 1). Your actual level is set by an AccessOAP care coordinator at the determination-of-needs interview.",
              )}
            </p>
          </div>
        </>
      )}
    </>
  );
}

const CLAIM_STATUSES: ClaimStatus[] = ["submitted", "approved", "reimbursed", "rejected"];

function ClaimsTracker({ allocation, claims }: { allocation: number; claims: FundingClaim[] }) {
  const { addClaim, setClaimStatus } = useCivicData();
  const { t, formatMoney, formatDate } = useI18n();
  const summary = summarizeClaims(allocation, claims);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), providerName: PROVIDERS[0].name, therapy: "aba" as TherapyType, amount: "" });
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter the amount on the receipt.");
      return;
    }
    if (amount > summary.remaining) {
      setError(t("That's more than the {amount} left in this year's allocation.", { amount: formatMoney(summary.remaining) }));
      return;
    }
    setError(null);
    addClaim({ date: form.date, providerName: form.providerName, therapy: form.therapy, amount });
    setForm((f) => ({ ...f, amount: "" }));
  };

  const pct = allocation ? Math.min(100, (summary.claimed / allocation) * 100) : 0;
  return (
    <SectionCard
      id="claims"
      title={t("Funding & claims")}
      icon={<Wallet size={16} />}
      actions={<Pill tone="info">{t("{amount} left", { amount: formatMoney(summary.remaining) })}</Pill>}
    >
      <div className="meter" role="img" aria-label={t("{claimed} claimed of {allocation}", { claimed: formatMoney(summary.claimed), allocation: formatMoney(allocation) })}>
        <div className="meter__track">
          <span className="meter__fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="meter__labels">
          <span>
            {t("{claimed} claimed · {reimbursed} reimbursed", { claimed: formatMoney(summary.claimed), reimbursed: formatMoney(summary.reimbursed) })}
          </span>
          <span>{t("Allocation {amount}", { amount: formatMoney(allocation) })}</span>
        </div>
      </div>
      {summary.reportingRequired && (
        <p className="fineprint">{t("Your funding comes in installments: report expenses before the next installment is released. Keep receipts for seven years.")}</p>
      )}

      <form className="claim-form" onSubmit={submit}>
        <label>
          <span className="field__label">{t("Date")}</span>
          <input className="field__input" type="date" value={form.date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </label>
        <label>
          <span className="field__label">{t("Provider")}</span>
          <select className="field__input field__select" value={form.providerName} onChange={(e) => setForm({ ...form, providerName: e.target.value })}>
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field__label">{t("Service")}</span>
          <select className="field__input field__select" value={form.therapy} onChange={(e) => setForm({ ...form, therapy: e.target.value as TherapyType })}>
            {(Object.keys(THERAPY_LABELS) as TherapyType[]).map((therapy) => (
              <option key={therapy} value={therapy}>
                {t(THERAPY_LABELS[therapy])}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field__label">{t("Amount")}</span>
          <div className="input-group">
            <span className="input-group__affix input-group__affix--prefix" aria-hidden="true">
              $
            </span>
            <input
              className="field__input field__input--has-prefix"
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              aria-invalid={Boolean(error)}
            />
          </div>
        </label>
        <button type="submit" className="btn btn--primary btn--sm">
          <Plus size={14} aria-hidden="true" /> {t("Log expense")}
        </button>
      </form>
      {error && (
        <p className="field__error" role="alert">
          {t(error)}
        </p>
      )}

      {claims.length === 0 ? (
        <p className="muted-block">{t("No expenses logged yet.")}</p>
      ) : (
        <table className="claims">
          <caption className="sr-only">{t("Logged expenses")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("Date")}</th>
              <th scope="col">{t("Provider")}</th>
              <th scope="col">{t("Service")}</th>
              <th scope="col" className="num">
                {t("Amount")}
              </th>
              <th scope="col">{t("Status")}</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((c) => (
              <tr key={c.id}>
                <td>{formatDate(`${c.date}T12:00:00`)}</td>
                <td>{c.providerName}</td>
                <td>{t(THERAPY_LABELS[c.therapy])}</td>
                <td className="num">{formatMoney(c.amount, true)}</td>
                <td>
                  <label className="sr-only" htmlFor={`claim-${c.id}`}>
                    {t("Status for {provider} on {date}", { provider: c.providerName, date: formatDate(`${c.date}T12:00:00`) })}
                  </label>
                  <select id={`claim-${c.id}`} className="claim-status" value={c.status} onChange={(e) => setClaimStatus(c.id, e.target.value as ClaimStatus)}>
                    {CLAIM_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {t(s[0].toUpperCase() + s.slice(1))}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </SectionCard>
  );
}

function ProvidersList({ therapies }: { therapies: TherapyType[] }) {
  const { t } = useI18n();
  const [onlyMatching, setOnlyMatching] = useState(therapies.length > 0);
  const list = PROVIDERS.filter((p) => !onlyMatching || p.therapies.some((therapy) => therapies.includes(therapy)));
  return (
    <SectionCard
      id="providers"
      title={t("Service providers")}
      icon={<BadgeCheck size={16} />}
      actions={
        therapies.length > 0 ? (
          <label className="toggle">
            <input type="checkbox" checked={onlyMatching} onChange={(e) => setOnlyMatching(e.target.checked)} /> {t("Matching needs")}
          </label>
        ) : null
      }
    >
      <ul className="providers">
        {list.map((p) => (
          <li key={p.id} className="provider">
            <div>
              <p className="provider__name">
                {p.name} {p.verified ? <Pill tone="success">{t("Verified")}</Pill> : <Pill tone="neutral">{t("Unverified")}</Pill>}
              </p>
              <p className="provider__meta">
                {p.therapies.map((therapy) => t(THERAPY_LABELS[therapy])).join(" · ")} · {p.neighbourhood} · {p.languages.map((l) => t(l)).join(", ")}
              </p>
            </div>
            <span className={`provider__status${p.acceptingClients ? "" : " is-full"}`}>{t(p.acceptingClients ? "Accepting" : "Waitlist")}</span>
          </li>
        ))}
      </ul>
      <p className="fineprint">{t("Illustrative directory. Confirm any provider with AccessOAP and their regulatory college before booking.")}</p>
    </SectionCard>
  );
}

const PeerSupport = () => {
  const { t } = useI18n();
  return (
    <SectionCard id="peer" title={t("Support for caregivers")} icon={<Users size={16} />}>
      <ul className="resources">
        {PEER_RESOURCES.map((r) => (
          <li key={r.id}>
            <a href={r.url} target="_blank" rel="noreferrer" className="resource">
              <span className="resource__name">
                {t(r.name)} <ExternalLink size={11} aria-hidden="true" />
              </span>
              <Tx className="resource__desc" text={r.description} />
            </a>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
};

export default function AutismModule({ onBack }: { onBack: () => void }) {
  const { data, requests, saveAutism, withdrawRequest } = useCivicData();
  const { t, formatDate } = useI18n();
  const record = data.autism;
  const request = requests.find((r) => r.id === record?.requestId);

  const [values, setValues] = useState<Record<string, unknown>>(INITIAL);
  const [domains, setDomains] = useState<Partial<Record<DevelopmentalDomain, DomainSeverity>>>({});
  const [preview, setPreview] = useState<{ intake: AutismIntake; triage: AutismTriageResult } | null>(null);

  const shell = (children: ReactNode, aside: ReactNode = <PeerSupport />) => (
    <ModuleShell
      eyebrow="Autistic Child Help Program · Ontario Autism Program"
      title="Autism support for your child"
      lede="A caregiver intake that maps your child's age and needs to Ontario Autism Program services, therapies and funding."
      icon={<Baby size={22} />}
      tone="family"
      onBack={onBack}
      aside={aside}
    >
      {children}
    </ModuleShell>
  );

  const steps: IntakeStep[] = [
    {
      id: "child",
      label: "Your child",
      title: "About your child",
      description: "The Ontario Autism Program serves children and youth under 18 living in Ontario.",
      fields: [
        text("childFirstName", "Child's first name", { autoComplete: "off" }),
        date("dateOfBirth", "Date of birth", { notAfterToday: true }),
        radio("livesInOntario", "Does your child live in Ontario?", yesNo),
        radio("diagnosisStatus", "Diagnosis", [
          ["diagnosed", "Diagnosed with autism"],
          ["assessment-pending", "Assessment underway"],
          ["concerns", "I have concerns, no assessment yet"],
        ]),
        radio("hasWrittenDiagnosis", "Do you have the diagnosis in writing from a qualified professional?", yesNo, {
          showIf: when("diagnosisStatus", "diagnosed"),
        }),
        radio("registeredWithOap", "Already registered with the Ontario Autism Program?", yesNo, {
          showIf: when("diagnosisStatus", "diagnosed"),
        }),
        radio("schoolStage", "School", [
          ["not-yet", "Not in school yet"],
          ["entering-school", "Starting kindergarten or grade 1 this year"],
          ["in-school", "Already in school"],
        ]),
        select("languageAtHome", "Main language at home", ["English", "French", "Arabic", "Mandarin", "Somali", "Spanish", "Other"]),
      ],
    },
    {
      id: "development",
      label: "Development",
      title: "Development and support needs",
      description: "Tell us where your child needs support. This helps map therapies and estimate funding.",
      fields: [
        radio("urgentSafetyConcern", "Is there a risk of harm to your child or others, or of losing housing or a school placement?", [
          ["no", "No"],
          ["yes", "Yes, it's urgent"],
        ]),
      ],
      render: () => (
        <DomainMatrix
          value={domains}
          onChange={(domain, severity) =>
            setDomains((prev) => {
              const next = { ...prev };
              if (severity === "none") delete next[domain];
              else next[domain] = severity;
              return next;
            })
          }
        />
      ),
    },
  ];

  if (record && request) {
    const allocation = record.triage.funding?.annualAmount ?? 0;
    const therapies = record.triage.therapies.map((match) => match.therapy);
    return shell(
      <>
        <SectionCard
          id="autism-overview"
          title={
            <>
              {t("{name}'s program", { name: record.intake.childFirstName })} {request.demo && <DemoTag />}
            </>
          }
          icon={<ListChecks size={16} />}
          actions={
            <button
              type="button"
              className="link-btn link-btn--muted"
              onClick={() => {
                if (window.confirm(t("Remove this intake and start again?"))) withdrawRequest(record.requestId);
              }}
            >
              <RotateCcw size={13} aria-hidden="true" /> {t("Start over")}
            </button>
          }
        >
          <p className="mono ref-line">
            {request.referenceId} · {t("Saved {date}", { date: formatDate(record.submittedAt) })}
          </p>
          <ol className="timeline timeline--horizontal">
            {request.stages.map((stage) => (
              <li key={stage.key} className={`timeline__item timeline__item--${stage.state}`}>
                <span className="timeline__dot" aria-hidden="true" />
                <div>
                  <p className="timeline__label">{t(stage.label)}</p>
                  <p className="timeline__meta">{stage.state === "blocked" ? t("Needs diagnosis") : stage.date ? formatDate(stage.date) : ""}</p>
                </div>
              </li>
            ))}
          </ol>
          <h3 className="subhead">{t("Next steps")}</h3>
          <ul className="next-steps">
            {record.triage.pathways
              .filter((p) => p.status === "recommended" || p.status === "eligible")
              .map((p) => (
                <li key={p.id}>
                  {p.status === "eligible" ? <CircleCheck size={15} aria-hidden="true" /> : <CircleDashed size={15} aria-hidden="true" />}
                  <span>
                    <strong>{t(p.name)}.</strong> <Tx text={p.nextStep} />
                  </span>
                </li>
              ))}
            {record.triage.pathways
              .filter((p) => p.status === "not-yet")
              .map((p) => (
                <li key={p.id} className="is-muted">
                  <CircleMinus size={15} aria-hidden="true" />
                  <span>
                    <strong>{t(p.name)}:</strong> <Tx text={p.reason} />
                  </span>
                </li>
              ))}
          </ul>
          <p className="aside-links">
            <a href={ACCESS_OAP_URL} target="_blank" rel="noreferrer">
              {t("Contact AccessOAP")} <ExternalLink size={11} aria-hidden="true" />
            </a>
          </p>
        </SectionCard>
        {record.triage.funding ? (
          <ClaimsTracker allocation={allocation} claims={record.claims} />
        ) : (
          <SectionCard id="claims" title={t("Funding & claims")} icon={<Receipt size={16} />}>
            <p className="muted-block">{t("Funding tracking opens once your child has a written diagnosis and an OAP funding allocation.")}</p>
          </SectionCard>
        )}
        <ProvidersList therapies={therapies} />
      </>,
      <PeerSupport />,
    );
  }

  if (preview) {
    return shell(
      <SectionCard id="autism-result" title={t("Your child's pathway")} icon={<Sparkles size={16} />}>
        <TriageResult triage={preview.triage} intake={preview.intake} />
        <div className="result-actions">
          <button type="button" className="btn btn--secondary" onClick={() => setPreview(null)}>
            {t("Edit answers")}
          </button>
          <button type="button" className="btn btn--primary" onClick={() => saveAutism({ intake: preview.intake, triage: preview.triage })}>
            <HandHeart size={15} aria-hidden="true" /> {t("Save to my dashboard")}
          </button>
        </div>
      </SectionCard>,
    );
  }

  return shell(
    <>
      <Notice tone="info">{t("If your child or anyone else is in immediate danger, call 9-1-1.")}</Notice>
      <IntakeStepper
        steps={steps}
        values={values}
        onChange={(name, value) => setValues((prev) => ({ ...prev, [name]: value }))}
        submitLabel="See pathways"
        onComplete={() => {
          const intake = toIntake(values, domains);
          setPreview({ intake, triage: triageAutismIntake(intake) });
        }}
      />
    </>,
  );
}
