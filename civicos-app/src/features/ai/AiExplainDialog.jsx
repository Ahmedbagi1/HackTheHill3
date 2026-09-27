import { useEffect, useState } from "react";
import { CircleAlert, Clock, ExternalLink, FileText, Pause, Play, Sparkles, UserCheck, X } from "lucide-react";
import TierBadge from "../../components/common/TierBadge";
import { useSpeechPlayer } from "../../components/voice/useSpeechPlayer";
import { useLanguage } from "../../context/LanguageContext";
import { useDialogBehavior } from "../../hooks/useDialogBehavior";
import { LOCALES } from "../../i18n/i18n";
import { isGeminiDisabled } from "../../services/api/gemini/geminiClient";
import { fallbackPolicySummary, simplifyServicePolicy } from "../../services/api/gemini/geminiSimplifier";

/** Languages with a usable speech voice (browser or ElevenLabs multilingual). */
const SPOKEN_LANGS = new Set(["en", "fr"]);

const ReadAloud = ({ text, cacheKey, lang }) => {
  const { t } = useLanguage();
  const { status, mode, play, pause } = useSpeechPlayer({ text, cacheKey, lang });
  const playing = status === "playing";
  return (
    <button
      type="button"
      className="btn btn--secondary btn--sm"
      onClick={playing ? pause : play}
      disabled={status === "loading" || !mode}
    >
      {playing ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
      {status === "loading"
        ? t("Preparing audio…", "Préparation de l'audio…")
        : playing
          ? t("Pause", "Pause")
          : status === "paused"
            ? t("Resume", "Reprendre")
            : t("Read aloud", "Lire à voix haute")}
    </button>
  );
};

/**
 * "AI Explain": a three-bullet, grade-8 summary of a service from Gemini, in the
 * active language. Falls back to the catalog's own wording when AI is unavailable.
 */
const AiExplainDialog = ({ service, onClose }) => {
  const { currentLang, t } = useLanguage();
  // The settled answer for one language; a different language (or none yet) means loading.
  const [settled, setSettled] = useState(null);
  const state = settled?.lang === currentLang ? settled : { status: "loading" };

  useDialogBehavior(onClose);

  useEffect(() => {
    const controller = new AbortController();
    simplifyServicePolicy(service, currentLang, { signal: controller.signal })
      .then((summary) => {
        if (!controller.signal.aborted) setSettled({ status: "ready", summary, lang: currentLang });
      })
      .catch((error) => {
        if (controller.signal.aborted || error.name === "AbortError") return;
        setSettled({
          status: "fallback",
          summary: fallbackPolicySummary(service),
          disabled: isGeminiDisabled(error),
          message: error.message,
          lang: currentLang,
        });
      });
    return () => controller.abort();
  }, [service, currentLang]);

  const summary = state.summary;
  // Fallback text is the catalog's English source.
  const contentLang = state.status === "ready" ? state.lang : "en";
  const bullets = summary
    ? [
        { key: "who", Icon: UserCheck, heading: t("Who qualifies", "Qui est admissible"), text: summary.whoQualifies },
        { key: "docs", Icon: FileText, heading: t("What to bring", "Documents à apporter"), text: summary.documents },
        { key: "time", Icon: Clock, heading: t("Processing time and fees", "Délais et frais"), text: summary.timeAndFees },
      ].filter((bullet) => bullet.text)
    : [];
  const script = bullets.map((b) => `${b.heading}. ${b.text}`).join(" ");

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal ai-explain" role="dialog" aria-modal="true" aria-labelledby="ai-explain-title">
        <div className="modal__header">
          <div>
            <p className="modal__eyebrow">
              <Sparkles size={13} aria-hidden="true" /> {t("Plain-language explainer", "Explication en langage clair")}
            </p>
            <h2 id="ai-explain-title" className="modal__title">
              {service.title}
              <TierBadge tier={service.tier} />
            </h2>
          </div>
          <button type="button" className="icon-btn" aria-label={t("Close", "Fermer")} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal__body" aria-live="polite" aria-busy={state.status === "loading"}>
          {state.status === "loading" && (
            <div className="ai-explain__loading">
              <p className="triage__loading">
                <Sparkles size={16} aria-hidden="true" className="triage__spark" />
                {t("Simplifying the fine print…", "Simplification des détails…")}
              </p>
              <div className="triage__shimmer" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}

          {state.status === "fallback" && (
            <p className="triage-notice triage-notice--inline" role="status">
              <CircleAlert size={16} aria-hidden="true" />
              <span>
                {state.disabled
                  ? t(
                      "AI explanations aren't available here. Here's the official summary instead.",
                      "Les explications par IA ne sont pas offertes ici. Voici plutôt le résumé officiel.",
                    )
                  : t(
                      `The AI explainer is unavailable right now (${state.message}). Here's the official summary instead.`,
                      `L'explication par IA est indisponible pour le moment (${state.message}). Voici plutôt le résumé officiel.`,
                    )}
              </span>
            </p>
          )}

          {bullets.length > 0 && (
            <ul className="ai-explain__list" lang={LOCALES[contentLang]}>
              {bullets.map(({ key, Icon, heading, text }) => (
                <li key={key} className="ai-explain__item">
                  <span className="ai-explain__icon" aria-hidden="true">
                    <Icon size={18} />
                  </span>
                  <div>
                    <h3 className="ai-explain__heading">{heading}</h3>
                    <p>{text}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {state.status === "ready" && (
            <p className="triage__disclaimer">
              {t(
                "Simplified by Gemini from the official program details. Confirm on the official site before applying.",
                "Simplifié par Gemini à partir des renseignements officiels. Vérifiez sur le site officiel avant de présenter une demande.",
              )}
            </p>
          )}
        </div>

        <div className="modal__footer">
          <a className="btn btn--ghost" href={service.officialUrl} target="_blank" rel="noreferrer">
            {t("Official site", "Site officiel")} <ExternalLink size={14} aria-hidden="true" />
          </a>
          <div className="modal__footer-end">
            {state.status !== "loading" && script && SPOKEN_LANGS.has(contentLang) ? (
              <ReadAloud
                key={`${service.id}-${contentLang}-${state.status}`}
                text={script}
                cacheKey={`explain-${service.id}-${contentLang}-${state.status}`}
                lang={LOCALES[contentLang]}
              />
            ) : (
              state.status === "ready" && (
                <span className="ai-explain__no-audio">
                  {t("Audio isn't available in this language yet.", "L'audio n'est pas encore offert dans cette langue.")}
                </span>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiExplainDialog;
