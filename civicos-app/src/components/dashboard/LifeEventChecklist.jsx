import { useState } from "react";
import { ArrowRight, ListChecks, Volume2 } from "lucide-react";
import { TIERS } from "../../data/servicesData";

/**
 * Cross-tier checklist for a matched life event. Steps are grouped by level
 * of government so citizens see Federal, Provincial and Municipal tasks at once.
 * Remount with key={lifeEvent.id} to reset progress for a new event.
 */
const LifeEventChecklist = ({ lifeEvent, servicesById, onStart, onListen }) => {
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
          <p className="journey__eyebrow">Your cross-government checklist</p>
          <h2 id="journey-title" className="journey__title">
            {lifeEvent.title}
          </h2>
          <p className="journey__intro">{lifeEvent.intro}</p>
        </div>
        <div className="journey__progress" aria-live="polite">
          <strong>
            {completed}/{steps.length}
          </strong>{" "}
          done
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
                {tier}
                <span>{tierSteps.length}</span>
              </h3>
              {tierSteps.length === 0 ? (
                <p className="journey__none">Nothing needed at this level.</p>
              ) : (
                <ol className="journey__steps">
                  {tierSteps.map((step) => {
                    const isDone = done.has(step.number);
                    return (
                      <li key={step.number} className={`journey-step${isDone ? " journey-step--done" : ""}`}>
                        <label className="journey-step__check">
                          <input type="checkbox" checked={isDone} onChange={() => toggle(step.number)} />
                          <span className="journey-step__number">{step.number}</span>
                          <span className="journey-step__action">{step.action}</span>
                        </label>
                        <div className="journey-step__links">
                          <button type="button" className="link-btn" onClick={() => onStart(step.service)}>
                            {step.service.title} <ArrowRight size={12} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="link-btn link-btn--muted"
                            aria-label={`Explain ${step.service.title}`}
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
