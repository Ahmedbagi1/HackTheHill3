import { useMemo } from "react";
import {
  AudioLines,
  Clock,
  ExternalLink,
  FileText,
  Languages,
  LoaderCircle,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  X,
} from "lucide-react";
import TierBadge from "../common/TierBadge";
import Waveform from "./Waveform";
import { useSpeechPlayer } from "./useSpeechPlayer";
import { useDialogBehavior } from "../../hooks/useDialogBehavior";
import { useLanguage } from "../../context/LanguageContext";
import { LOCALES } from "../../i18n/i18n";

const buildVoiceScript = (service) =>
  [
    `${service.title}.`,
    service.plainLanguage,
    `What you'll need: ${service.requirements.join("; ")}.`,
    `Typical timing: ${service.time}.`,
  ].join(" ");

const MODE_LABELS = {
  elevenlabs: { icon: Sparkles, text: "ElevenLabs voice", className: "voice-mode--live" },
  browser: { icon: AudioLines, text: "Browser voice (simulated)", className: "voice-mode--sim" },
};

/**
 * "Explain to Citizen" drawer: reads a plain-language briefing aloud with a
 * live waveform, and shows the transcript and checklist alongside.
 */
const ElevenLabsVoiceAssistant = ({ service, onClose, onStartApplication }) => {
  const { currentLang, language, t } = useLanguage();
  const script = useMemo(() => buildVoiceScript(service), [service]);
  const { status, mode, progress, error, analyser, play, pause, restart } = useSpeechPlayer({
    text: script,
    cacheKey: service.id,
  });

  useDialogBehavior(onClose);

  const isPlaying = status === "playing";
  const modeLabel = MODE_LABELS[mode];
  const ModeIcon = modeLabel?.icon;

  return (
    <div
      className="drawer-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="voice-title">
        <div className="drawer__header">
          <div>
            <p className="modal__eyebrow">
              <Volume2 size={13} aria-hidden="true" /> {t("audio.summary")}
            </p>
            <h2 id="voice-title" className="drawer__title">
              {service.title}
            </h2>
            <div className="drawer__meta">
              <TierBadge tier={service.tier} />
              <span className="lang-badge" title={`${t("language.label")}: ${language.englishName}`}>
                <Languages size={12} aria-hidden="true" />
                <span lang={LOCALES[currentLang]}>{language.label}</span>
                {/* Service content and narration are English-only for now; say so rather than imply otherwise. */}
                {currentLang !== "en" && (
                  <span className="lang-badge__note">· {t("audio in English", "audio en anglais")}</span>
                )}
              </span>
              {modeLabel && (
                <span className={`voice-mode ${modeLabel.className}`}>
                  <ModeIcon size={12} aria-hidden="true" /> {modeLabel.text}
                </span>
              )}
            </div>
          </div>
          <button type="button" className="icon-btn" aria-label={t("Close", "Fermer")} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="player">
          <Waveform analyser={analyser} active={isPlaying} live={mode === "elevenlabs"} />
          <div
            className="player__progress"
            role="progressbar"
            aria-label="Playback progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
          >
            <span style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="player__controls">
            <button
              type="button"
              className="player__play"
              onClick={isPlaying ? pause : play}
              disabled={status === "loading" || !mode}
              aria-label={isPlaying ? "Pause" : status === "paused" ? "Resume" : "Play briefing"}
            >
              {status === "loading" ? (
                <LoaderCircle size={24} className="spin" aria-hidden="true" />
              ) : isPlaying ? (
                <Pause size={24} aria-hidden="true" />
              ) : (
                <Play size={24} aria-hidden="true" />
              )}
            </button>
            <div className="player__status" aria-live="polite">
              {status === "loading" && "Generating voice…"}
              {status === "playing" && "Playing briefing"}
              {status === "paused" && "Paused"}
              {status === "ended" && "Finished — press play to hear it again"}
              {(status === "idle" || status === "error") && "Press play to hear a plain-language briefing"}
            </div>
            <button
              type="button"
              className="icon-btn"
              aria-label="Restart"
              onClick={restart}
              disabled={status === "idle"}
            >
              <RotateCcw size={18} />
            </button>
          </div>
          {error && (
            <p className="player__error" role="status">
              {error}
            </p>
          )}
          {!mode && status === "idle" && (
            <p className="player__error" role="status">
              Audio isn't available in this browser. Read the summary below.
            </p>
          )}
        </div>

        <div className="drawer__body">
          <section className="transcript">
            <h3 className="transcript__heading">
              <FileText size={14} aria-hidden="true" /> In plain language
            </h3>
            <p>{service.plainLanguage}</p>
          </section>
          <section className="transcript">
            <h3 className="transcript__heading">What you'll need</h3>
            <ul className="requirements-list">
              {service.requirements.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
          <p className="transcript__time">
            <Clock size={14} aria-hidden="true" /> {service.time} · {service.agency}
          </p>
        </div>

        <div className="drawer__footer">
          <a className="btn btn--ghost" href={service.officialUrl} target="_blank" rel="noreferrer">
            {t("Official site", "Site officiel")} <ExternalLink size={14} aria-hidden="true" />
          </a>
          {onStartApplication && (
            <button type="button" className="btn btn--primary" onClick={() => onStartApplication(service)}>
              {t("action.startApplication")}
            </button>
          )}
        </div>
      </aside>
    </div>
  );
};

export default ElevenLabsVoiceAssistant;
