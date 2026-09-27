import { useState, type ReactNode } from "react";
import {
  Accessibility,
  CircleCheck,
  CircleDashed,
  CircleX,
  Clock,
  ExternalLink,
  HeartPulse,
  Languages,
  MapPin,
  MoonStar,
  RotateCcw,
  ShieldCheck,
  Stethoscope,
  TriangleAlert,
  Video,
} from "lucide-react";
import { PATTERNS, checks, date, number, radio, select, text } from "../../data/fieldBuilders";
import { useCivicData } from "../../state/civicDataStore";
import { useI18n } from "../../i18n/i18nContext";
import Tx from "../../i18n/Tx";
import { DemoTag, Notice, Pill, SectionCard } from "../../components/ui/primitives";
import ModuleShell from "../shared/ModuleShell";
import IntakeStepper, { type IntakeStep } from "../shared/IntakeStepper";
import { CARE_NEEDS, HEALTH_CARE_CONNECT_URL, LANGUAGES, NEIGHBOURHOODS } from "./clinicDirectory";
import { buildVerification, matchClinics } from "./doctorMatching";
import type { CareNeed, ClinicMatch, DoctorMatchResult, PatientIntake, SpokenLanguage, VerificationStep } from "../../types/doctor";

const yesNo = [
  ["yes", "Yes"],
  ["no", "No"],
];

const STEPS: IntakeStep[] = [
  {
    id: "about",
    label: "About you",
    title: "About you",
    description: "Your OHIP number and where you live help us find clinics you can reach.",
    fields: [
      text("healthNumber", "Ontario health number", {
        placeholder: "1234-567-890-AB",
        maxLength: 15,
        transform: "uppercase",
        pattern: PATTERNS.ohip,
        autoComplete: "off",
      }),
      date("dateOfBirth", "Date of birth", { notAfterToday: true, autoComplete: "bday" }),
      select("neighbourhoodId", "Your neighbourhood", NEIGHBOURHOODS.map((n) => [n.id, n.label]), { full: true }),
      checks("languages", "Languages you'd like care in", LANGUAGES.map((l) => [l, l]), {
        requiredMessage: "Choose at least one language.",
      }),
      radio("languageRequired", "Must the clinic speak one of these?", [
        ["yes", "Yes, it's required"],
        ["no", "Preferred, not required"],
      ]),
    ],
  },
  {
    id: "needs",
    label: "Care needs",
    title: "Your care needs and preferences",
    description: "We match clinics that offer the care you need. People with greater health needs are prioritised.",
    fields: [
      checks("needs", "Care you need", CARE_NEEDS.map((n) => [n.id, n.label]), { optional: true }),
      number("chronicConditions", "Number of ongoing health conditions", { max: 20 }),
      radio("recentHospitalDischarge", "Discharged from hospital in the last 3 months?", yesNo),
      radio("pregnant", "Are you pregnant?", yesNo),
      radio("wheelchair", "Do you need a wheelchair-accessible clinic?", yesNo),
      select("maxDistanceKm", "How far can you travel?", [
        ["5", "Up to 5 km"],
        ["10", "Up to 10 km"],
        ["15", "Up to 15 km"],
        ["30", "Up to 30 km"],
      ]),
      radio("providerPreference", "Provider type", [
        ["any", "No preference"],
        ["family-physician", "Family physician"],
        ["nurse-practitioner", "Nurse practitioner"],
      ]),
      radio("eveningHoursPreferred", "Do you need evening appointments?", yesNo),
      radio("virtualCareOk", "Are virtual visits okay?", yesNo),
    ],
  },
];

const INITIAL: Record<string, unknown> = {
  healthNumber: "",
  dateOfBirth: "",
  neighbourhoodId: "",
  languages: ["English"],
  languageRequired: "",
  needs: [],
  chronicConditions: "0",
  recentHospitalDischarge: "",
  pregnant: "",
  wheelchair: "",
  maxDistanceKm: "",
  providerPreference: "",
  eveningHoursPreferred: "",
  virtualCareOk: "",
};

function toIntake(v: Record<string, unknown>): PatientIntake {
  return {
    healthNumber: String(v.healthNumber ?? ""),
    dateOfBirth: String(v.dateOfBirth ?? ""),
    neighbourhoodId: String(v.neighbourhoodId),
    languages: (v.languages as SpokenLanguage[]) ?? [],
    languageRequired: v.languageRequired === "yes",
    needs: (v.needs as CareNeed[]) ?? [],
    wheelchairAccessRequired: v.wheelchair === "yes",
    maxDistanceKm: Number(v.maxDistanceKm) || 10,
    providerPreference: v.providerPreference as PatientIntake["providerPreference"],
    eveningHoursPreferred: v.eveningHoursPreferred === "yes",
    virtualCareOk: v.virtualCareOk === "yes",
    complexity: {
      chronicConditions: Number(v.chronicConditions) || 0,
      recentHospitalDischarge: v.recentHospitalDischarge === "yes",
      pregnant: v.pregnant === "yes",
    },
  };
}

const STATUS_PILL = {
  accepting: { tone: "success", label: "Accepting patients" },
  waitlist: { tone: "warning", label: "Waitlist" },
  closed: { tone: "neutral", label: "Closed" },
} as const;

function ScoreRing({ score }: { score: number }) {
  const { t } = useI18n();
  return (
    <span className="score" style={{ ["--score" as string]: score }} role="img" aria-label={t("Match score {score} out of 100", { score })}>
      <span>{score}</span>
    </span>
  );
}

function MatchCard({ match, onChoose, chosen }: { match: ClinicMatch; onChoose?: () => void; chosen?: boolean }) {
  const { t, formatNumber } = useI18n();
  const c = match.clinic;
  const status = STATUS_PILL[c.acceptingStatus];
  return (
    <article className={`match${chosen ? " match--chosen" : ""}`}>
      <ScoreRing score={match.score} />
      <div className="match__body">
        <div className="match__head">
          <h3 className="match__title">{c.name}</h3>
          <Pill tone={status.tone}>{t(status.label)}</Pill>
        </div>
        <p className="match__meta">
          <MapPin size={12} aria-hidden="true" /> {c.neighbourhood} ·{" "}
          {t("{distance} km", { distance: formatNumber(match.distanceKm, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) })}
          <span aria-hidden="true">·</span>
          <Stethoscope size={12} aria-hidden="true" />{" "}
          {t(c.providerType === "team" ? "Team-based care" : c.providerType === "nurse-practitioner" ? "Nurse practitioners" : "Family physicians")}
        </p>
        <ul className="match__tags" aria-label={t("Clinic features")}>
          <li>
            <Languages size={12} aria-hidden="true" /> {c.languages.map((l) => t(l)).join(", ")}
          </li>
          {c.wheelchairAccessible && (
            <li>
              <Accessibility size={12} aria-hidden="true" /> {t("Accessible")}
            </li>
          )}
          {c.eveningHours && (
            <li>
              <MoonStar size={12} aria-hidden="true" /> {t("Evenings")}
            </li>
          )}
          {c.virtualCare && (
            <li>
              <Video size={12} aria-hidden="true" /> {t("Virtual")}
            </li>
          )}
        </ul>
        <ul className="match__reasons">
          {match.reasons.map((r) => (
            <li key={r} className="reason reason--good">
              <CircleCheck size={13} aria-hidden="true" /> {t(r)}
            </li>
          ))}
          {match.gaps.map((g) => (
            <li key={g} className="reason reason--gap">
              <TriangleAlert size={13} aria-hidden="true" /> {t(g)}
            </li>
          ))}
        </ul>
      </div>
      <div className="match__side">
        <p className="match__wait">
          <Clock size={13} aria-hidden="true" /> {t("~{weeks} wk", { weeks: match.estimatedWaitWeeks })}
        </p>
        <p className="match__position">{t("Position #{position}", { position: match.waitlistPosition })}</p>
        {onChoose && (
          <button type="button" className="btn btn--primary btn--sm" onClick={onChoose}>
            {t("Choose")}
          </button>
        )}
      </div>
    </article>
  );
}

function VerificationList({ steps }: { steps: VerificationStep[] }) {
  const { t } = useI18n();
  return (
    <ul className="verify">
      {steps.map((step) => (
        <li key={step.id} className={`verify__item verify__item--${step.status}`}>
          {step.status === "complete" ? (
            <CircleCheck size={16} aria-hidden="true" />
          ) : step.status === "failed" ? (
            <CircleX size={16} aria-hidden="true" />
          ) : (
            <CircleDashed size={16} aria-hidden="true" />
          )}
          <div>
            <p className="verify__label">
              {t(step.label)} <span className="sr-only">{t(step.status)}</span>
            </p>
            <Tx as="p" className="verify__detail" text={step.detail} />
          </div>
        </li>
      ))}
    </ul>
  );
}

const HccCard = () => {
  const { t } = useI18n();
  return (
    <SectionCard id="hcc" title={t("Health Care Connect")} icon={<HeartPulse size={16} />}>
      <p className="aside-text">
        {t(
          "Ontario's official program for finding a family doctor or nurse practitioner. Register online or call 8-1-1. Participation is voluntary and people with greater health needs are prioritised.",
        )}
      </p>
      <p className="aside-links">
        <a href={HEALTH_CARE_CONNECT_URL} target="_blank" rel="noreferrer">
          {t("Register with Health Care Connect")} <ExternalLink size={11} aria-hidden="true" />
        </a>
      </p>
      <p className="fineprint">{t("The clinic directory in CivicOS is illustrative sample data to demonstrate matching. It is not a list of real clinics.")}</p>
    </SectionCard>
  );
};

export default function DoctorModule({ onBack }: { onBack: () => void }) {
  const { data, requests, emailVerified, signedIn, saveDoctor, updateDoctorVerification, withdrawRequest } = useCivicData();
  const { t, tp, formatDate } = useI18n();
  const record = data.doctor;
  const request = requests.find((r) => r.id === record?.requestId);

  const [values, setValues] = useState<Record<string, unknown>>(INITIAL);
  const [intake, setIntake] = useState<PatientIntake | null>(null);
  const [result, setResult] = useState<DoctorMatchResult | null>(null);
  const [chosen, setChosen] = useState<ClinicMatch | null>(null);
  const [consent, setConsent] = useState(false);
  const [showExcluded, setShowExcluded] = useState(false);

  const shell = (children: ReactNode) => (
    <ModuleShell
      eyebrow="Family Doctor Connection · Ontario"
      title="Find a family doctor"
      lede="Match with primary care clinics by distance, language and the care you need, then join a waitlist with verified details."
      icon={<HeartPulse size={22} />}
      tone="health"
      onBack={onBack}
      aside={<HccCard />}
    >
      {children}
    </ModuleShell>
  );

  if (record && request) {
    const pendingVerification = record.verification.some((v) => v.id !== "identity" && v.status !== "complete");
    return shell(
      <>
        <SectionCard
          id="doctor-status"
          title={
            <>
              {t("Your waitlist")} {request.demo && <DemoTag />}
            </>
          }
          icon={<ShieldCheck size={16} />}
          actions={
            <button
              type="button"
              className="link-btn link-btn--muted"
              onClick={() => {
                if (window.confirm(t("Leave this waitlist and search again?"))) withdrawRequest(record.requestId);
              }}
            >
              <RotateCcw size={13} aria-hidden="true" /> {t("Search again")}
            </button>
          }
        >
          <p className="mono ref-line">
            {request.referenceId} · {t("Joined {date}", { date: formatDate(record.submittedAt) })}
          </p>
          <ol className="timeline timeline--horizontal">
            {request.stages.map((stage) => (
              <li key={stage.key} className={`timeline__item timeline__item--${stage.state}`}>
                <span className="timeline__dot" aria-hidden="true" />
                <div>
                  <p className="timeline__label">{t(stage.label)}</p>
                  <p className="timeline__meta">
                    {stage.state === "blocked" ? t("Needs verification") : stage.date ? formatDate(stage.date) : stage.state === "current" ? t("In progress") : ""}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <MatchCard match={record.match} />
          <h3 className="subhead">{t("Verification")}</h3>
          <VerificationList steps={record.verification} />
          {pendingVerification && (
            <div className="verify-actions">
              {!signedIn && <Notice tone="info">{t("Sign in with a verified CivicOS account from your profile in the menu, then refresh verification.")}</Notice>}
              <label className="checkbox">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>{t("I consent to CivicOS sharing my intake with {clinic}.", { clinic: record.match.clinic.name })}</span>
              </label>
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() =>
                  updateDoctorVerification(
                    buildVerification(record.intake, {
                      emailVerified,
                      consentGiven: consent || record.verification.some((v) => v.id === "consent" && v.status === "complete"),
                    }),
                  )
                }
              >
                {t("Refresh verification")}
              </button>
            </div>
          )}
          <p className="fineprint">{t("Waitlist position and timing are estimates from the sample directory.")}</p>
        </SectionCard>
      </>,
    );
  }

  if (result && intake && chosen) {
    const verification = buildVerification(intake, { emailVerified, consentGiven: consent });
    const healthOk = verification.find((v) => v.id === "health-number")?.status === "complete";
    return shell(
      <SectionCard id="doctor-verify" title={t("Verify and join the waitlist")} icon={<ShieldCheck size={16} />}>
        <MatchCard match={chosen} chosen />
        <VerificationList steps={verification} />
        {!emailVerified && (
          <Notice tone="info">
            {t("You can join now; the clinic can't contact you until your email is verified. Sign in with a verified CivicOS account to complete this step.")}
          </Notice>
        )}
        <label className="checkbox">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>{t("I consent to CivicOS sharing my intake with {clinic}.", { clinic: chosen.clinic.name })}</span>
        </label>
        <div className="result-actions">
          <button type="button" className="btn btn--secondary" onClick={() => setChosen(null)}>
            {t("Back to matches")}
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!healthOk || !consent}
            onClick={() =>
              saveDoctor({ intake, selectedClinicId: chosen.clinic.id, match: chosen, priority: result.priority, verification })
            }
          >
            {t("Join waitlist")}
          </button>
        </div>
      </SectionCard>,
    );
  }

  if (result && intake) {
    return shell(
      <SectionCard
        id="doctor-matches"
        title={tp("{count} clinic matched", "{count} clinics matched", result.matches.length)}
        icon={<Stethoscope size={16} />}
      >
        {result.priority === "high" && (
          <Notice tone="info">
            <strong>{t("Higher-need priority:")}</strong> {result.priorityReasons.map((r) => t(r)).join(", ")}. {t("Estimated waits reflect earlier placement.")}
          </Notice>
        )}
        {result.matches.length === 0 ? (
          <Notice tone="warning">{t("No clinics fit all your requirements. Try a longer travel distance or make language preferred rather than required.")}</Notice>
        ) : (
          <div className="matches">
            {result.matches.map((m) => (
              <MatchCard key={m.clinic.id} match={m} onChoose={() => setChosen(m)} />
            ))}
          </div>
        )}
        {result.excluded.length > 0 && (
          <div className="excluded">
            <button type="button" className="link-btn" aria-expanded={showExcluded} onClick={() => setShowExcluded((s) => !s)}>
              {showExcluded
                ? tp("Hide {count} clinic that didn't fit", "Hide {count} clinics that didn't fit", result.excluded.length)
                : tp("Show {count} clinic that didn't fit", "Show {count} clinics that didn't fit", result.excluded.length)}
            </button>
            {showExcluded && (
              <ul className="excluded__list">
                {result.excluded.map((e) => (
                  <li key={e.clinic.id}>
                    <strong>{e.clinic.name}</strong> · {t(e.reason)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="result-actions">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => {
              setResult(null);
              setIntake(null);
            }}
          >
            {t("Edit answers")}
          </button>
        </div>
        <p className="fineprint">{t("Scores weigh distance (30), language (20), care needs (25), availability (15) and convenience (10). Sample directory.")}</p>
      </SectionCard>,
    );
  }

  return shell(
    <IntakeStepper
      steps={STEPS}
      values={values}
      onChange={(name, value) => setValues((prev) => ({ ...prev, [name]: value }))}
      submitLabel="Find clinics"
      onComplete={() => {
        const next = toIntake(values);
        setIntake(next);
        setResult(matchClinics(next));
      }}
    />,
  );
}
