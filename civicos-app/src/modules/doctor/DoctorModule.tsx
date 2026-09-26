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
import { shortDate } from "../../lib/time";
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
  accepting: <Pill tone="success">Accepting patients</Pill>,
  waitlist: <Pill tone="warning">Waitlist</Pill>,
  closed: <Pill tone="neutral">Closed</Pill>,
};

function ScoreRing({ score }: { score: number }) {
  return (
    <span className="score" style={{ ["--score" as string]: score }} role="img" aria-label={`Match score ${score} out of 100`}>
      <span>{score}</span>
    </span>
  );
}

function MatchCard({ match, onChoose, chosen }: { match: ClinicMatch; onChoose?: () => void; chosen?: boolean }) {
  const c = match.clinic;
  return (
    <article className={`match${chosen ? " match--chosen" : ""}`}>
      <ScoreRing score={match.score} />
      <div className="match__body">
        <div className="match__head">
          <h3 className="match__title">{c.name}</h3>
          {STATUS_PILL[c.acceptingStatus]}
        </div>
        <p className="match__meta">
          <MapPin size={12} aria-hidden="true" /> {c.neighbourhood} · {match.distanceKm.toFixed(1)} km
          <span aria-hidden="true">·</span>
          <Stethoscope size={12} aria-hidden="true" />{" "}
          {c.providerType === "team" ? "Team-based care" : c.providerType === "nurse-practitioner" ? "Nurse practitioners" : "Family physicians"}
        </p>
        <ul className="match__tags" aria-label="Clinic features">
          <li>
            <Languages size={12} aria-hidden="true" /> {c.languages.join(", ")}
          </li>
          {c.wheelchairAccessible && (
            <li>
              <Accessibility size={12} aria-hidden="true" /> Accessible
            </li>
          )}
          {c.eveningHours && (
            <li>
              <MoonStar size={12} aria-hidden="true" /> Evenings
            </li>
          )}
          {c.virtualCare && (
            <li>
              <Video size={12} aria-hidden="true" /> Virtual
            </li>
          )}
        </ul>
        <ul className="match__reasons">
          {match.reasons.map((r) => (
            <li key={r} className="reason reason--good">
              <CircleCheck size={13} aria-hidden="true" /> {r}
            </li>
          ))}
          {match.gaps.map((g) => (
            <li key={g} className="reason reason--gap">
              <TriangleAlert size={13} aria-hidden="true" /> {g}
            </li>
          ))}
        </ul>
      </div>
      <div className="match__side">
        <p className="match__wait">
          <Clock size={13} aria-hidden="true" /> ~{match.estimatedWaitWeeks} wk
        </p>
        <p className="match__position">Position #{match.waitlistPosition}</p>
        {onChoose && (
          <button type="button" className="btn btn--primary btn--sm" onClick={onChoose}>
            Choose
          </button>
        )}
      </div>
    </article>
  );
}

function VerificationList({ steps }: { steps: VerificationStep[] }) {
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
              {step.label} <span className="sr-only">{step.status}</span>
            </p>
            <p className="verify__detail">{step.detail}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

const HccCard = () => (
  <SectionCard id="hcc" title="Health Care Connect" icon={<HeartPulse size={16} />}>
    <p className="aside-text">
      Ontario's official program for finding a family doctor or nurse practitioner. Register online or call <strong>8-1-1</strong>. Participation is voluntary
      and people with greater health needs are prioritised.
    </p>
    <p className="aside-links">
      <a href={HEALTH_CARE_CONNECT_URL} target="_blank" rel="noreferrer">
        Register with Health Care Connect <ExternalLink size={11} aria-hidden="true" />
      </a>
    </p>
    <p className="fineprint">
      The clinic directory in CivicOS is illustrative sample data to demonstrate matching. It is not a list of real clinics.
    </p>
  </SectionCard>
);

export default function DoctorModule({ onBack }: { onBack: () => void }) {
  const { data, requests, emailVerified, signedIn, saveDoctor, updateDoctorVerification, withdrawRequest } = useCivicData();
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
              Your waitlist {request.demo && <DemoTag />}
            </>
          }
          icon={<ShieldCheck size={16} />}
          actions={
            <button
              type="button"
              className="link-btn link-btn--muted"
              onClick={() => {
                if (window.confirm("Leave this waitlist and search again?")) withdrawRequest(record.requestId);
              }}
            >
              <RotateCcw size={13} aria-hidden="true" /> Search again
            </button>
          }
        >
          <p className="mono ref-line">
            {request.referenceId} · Joined {shortDate(record.submittedAt)}
          </p>
          <ol className="timeline timeline--horizontal">
            {request.stages.map((stage) => (
              <li key={stage.key} className={`timeline__item timeline__item--${stage.state}`}>
                <span className="timeline__dot" aria-hidden="true" />
                <div>
                  <p className="timeline__label">{stage.label}</p>
                  <p className="timeline__meta">
                    {stage.state === "blocked" ? "Needs verification" : stage.date ? shortDate(stage.date) : stage.state === "current" ? "In progress" : ""}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <MatchCard match={record.match} />
          <h3 className="subhead">Verification</h3>
          <VerificationList steps={record.verification} />
          {pendingVerification && (
            <div className="verify-actions">
              {!signedIn && <Notice tone="info">Sign in with a verified CivicOS account (top right), then refresh verification.</Notice>}
              <label className="checkbox">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>I consent to CivicOS sharing my intake with {record.match.clinic.name}.</span>
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
                Refresh verification
              </button>
            </div>
          )}
          <p className="fineprint">Waitlist position and timing are estimates from the sample directory.</p>
        </SectionCard>
      </>,
    );
  }

  if (result && intake && chosen) {
    const verification = buildVerification(intake, { emailVerified, consentGiven: consent });
    const healthOk = verification.find((v) => v.id === "health-number")?.status === "complete";
    return shell(
      <SectionCard id="doctor-verify" title="Verify and join the waitlist" icon={<ShieldCheck size={16} />}>
        <MatchCard match={chosen} chosen />
        <VerificationList steps={verification} />
        {!emailVerified && (
          <Notice tone="info">
            You can join now; the clinic can't contact you until your email is verified. Sign in with a verified CivicOS account to complete this step.
          </Notice>
        )}
        <label className="checkbox">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>I consent to CivicOS sharing my intake with {chosen.clinic.name}.</span>
        </label>
        <div className="result-actions">
          <button type="button" className="btn btn--secondary" onClick={() => setChosen(null)}>
            Back to matches
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!healthOk || !consent}
            onClick={() =>
              saveDoctor({ intake, selectedClinicId: chosen.clinic.id, match: chosen, priority: result.priority, verification })
            }
          >
            Join waitlist
          </button>
        </div>
      </SectionCard>,
    );
  }

  if (result && intake) {
    return shell(
      <SectionCard id="doctor-matches" title={`${result.matches.length} clinic${result.matches.length === 1 ? "" : "s"} matched`} icon={<Stethoscope size={16} />}>
        {result.priority === "high" && (
          <Notice tone="info">
            <strong>Higher-need priority:</strong> {result.priorityReasons.join(", ")}. Estimated waits reflect earlier placement.
          </Notice>
        )}
        {result.matches.length === 0 ? (
          <Notice tone="warning">No clinics fit all your requirements. Try a longer travel distance or make language preferred rather than required.</Notice>
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
              {showExcluded ? "Hide" : "Show"} {result.excluded.length} clinics that didn't fit
            </button>
            {showExcluded && (
              <ul className="excluded__list">
                {result.excluded.map((e) => (
                  <li key={e.clinic.id}>
                    <strong>{e.clinic.name}</strong> · {e.reason}
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
            Edit answers
          </button>
        </div>
        <p className="fineprint">Scores weigh distance (30), language (20), care needs (25), availability (15) and convenience (10). Sample directory.</p>
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
