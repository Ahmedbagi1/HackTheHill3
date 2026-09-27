import { useState } from "react";
import { ArrowRight, ListChecks, Volume2 } from "lucide-react";
import { TIERS } from "../../data/servicesData";
import { useI18n } from "../../i18n/i18nContext";
import Tx from "../../i18n/Tx";

/**
 * Cross-tier checklist for a matched life event. Steps are grouped by level
 * of government so citizens see Federal, Provincial and Municipal tasks at once.
 * Remount with key={lifeEvent.id} to reset progress for a new event.
 */
const LifeEventChecklist = ({ lifeEvent, servicesById, onStart, onListen }) => {
  const { t } = useI18n();
  const [done, setDone] = useState(() => new Set());

  const steps = lifeEvent.steps
    .map((step, index) => ({ ...step, number: index + 1, service: servicesById[step.serviceId] }))
    .filter((step) => step.service);

  const toggle = (number) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(number)) next.delete(number);
      else next.add(number);
      return next;
    });

  const completed = steps.filter((s) => done.has(s.number)).length;

  return (
    <section className="journey" aria-labelledby="journey-title">
      <div className="journey__header">
        <span className="journey__icon" aria-hidden="true">
          <ListChecks size={20} />
        </span>
        <div className="journey__heading">
          <p className="journey__eyebrow">{t("Your cross-government checklist")}</p>
          <Tx as="h2" id="journey-title" className="journey__title" text={lifeEvent.title} />
          <Tx as="p" className="journey__intro" text={lifeEvent.intro} />
        </div>
        <div className="journey__progress" aria-live="polite">
          {t("{done} of {total} done", { done: completed, total: steps.length })}
          <span className="journey__bar">
            <span style={{ width: `${(completed / steps.length) * 100}%` }} />
          </span>
        </div>
      </div>

      <div className="journey__columns">
        {TIERS.map((tier) => {
          const tierSteps = steps.filter((s) => s.service.tier === tier);
          return (
            <div key={tier} className={`journey__column journey__column--${tier.toLowerCase()}`}>
              <h3 className="journey__tier">
                {t(tier)}
                <span>{tierSteps.length}</span>
              </h3>
              {tierSteps.length === 0 ? (
                <p className="journey__none">{t("Nothing needed at this level.")}</p>
              ) : (
                <ol className="journey__steps">
                  {tierSteps.map((step) => {
                    const isDone = done.has(step.number);
                    return (
                      <li key={step.number} className={`journey-step${isDone ? " journey-step--done" : ""}`}>
                        <label className="journey-step__check">
                          <input type="checkbox" checked={isDone} onChange={() => toggle(step.number)} />
                          <span className="journey-step__number">{step.number}</span>
                          <Tx className="journey-step__action" text={step.action} />
                        </label>
                        <div className="journey-step__links">
                          <button type="button" className="link-btn" onClick={() => onStart(step.service)}>
                            {t(step.service.title)} <ArrowRight size={12} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="link-btn link-btn--muted"
                            aria-label={t("Audio summary of {service}, voiced by ElevenLabs", { service: t(step.service.title) })}
                            onClick={() => onListen(step.service)}
                          >
                            <Volume2 size={13} aria-hidden="true" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default LifeEventChecklist;
