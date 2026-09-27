import { AudioLines, Clock, ExternalLink, FileText, LoaderCircle, Pause, Play, RotateCcw, Sparkles, Volume2, X } from "lucide-react";
import TierBadge from "../common/TierBadge";
import Waveform from "./Waveform";
import { useSpeechPlayer } from "./useSpeechPlayer";
import { useDialogBehavior } from "../../hooks/useDialogBehavior";
import { useI18n } from "../../i18n/i18nContext";
import Tx from "../../i18n/Tx";

const MODE_LABELS = {
  elevenlabs: { icon: Sparkles, text: "ElevenLabs voice", className: "voice-mode--live" },
  browser: { icon: AudioLines, text: "Browser voice (simulated)", className: "voice-mode--sim" },
};

/**
 * Audio summary drawer: reads a plain-language briefing aloud with a live
 * waveform, and shows the transcript and checklist alongside. The briefing is
 * read in the active language when it's fully translated (English, French);
 * draft languages hear the English briefing, since the voices can't speak them.
 */
const ElevenLabsVoiceAssistant = ({ service, onClose, onStartApplication }) => {
  const { t, info } = useI18n();
  const spokenInLocale = info.status === "complete";
  const speak = (text) => (spokenInLocale ? t(text) : text);

  const script = [
    `${speak(service.title)}.`,
    speak(service.plainLanguage),
    spokenInLocale
      ? t("What you'll need: {items}.", { items: service.requirements.map((item) => t(item)).join("; ") })
      : `What you'll need: ${service.requirements.join("; ")}.`,
    spokenInLocale ? t("Typical timing: {time}.", { time: t(service.time) }) : `Typical timing: ${service.time}.`,
  ].join(" ");
  const speechLang = spokenInLocale ? info.htmlLang : "en-CA";
  const { status, mode, progress, error, analyser, play, pause, restart } = useSpeechPlayer({
    text: script,
    cacheKey: `${service.id}:${speechLang}`,
    lang: speechLang,
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
              <Volume2 size={13} aria-hidden="true" /> {t("Audio summary")}
            </p>
            <h2 id="voice-title" className="drawer__title">
              {t(service.title)}
            </h2>
            <div className="drawer__meta">
              <TierBadge tier={service.tier} />
              {modeLabel && (
                <span className={`voice-mode ${modeLabel.className}`}>
                  <ModeIcon size={12} aria-hidden="true" /> {t(modeLabel.text)}
                </span>
              )}
            </div>
          </div>
          <button type="button" className="icon-btn" aria-label={t("Close audio summary")} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="player">
          <Waveform analyser={analyser} active={isPlaying} live={mode === "elevenlabs"} />
          <div
            className="player__progress"
            role="progressbar"
            aria-label={t("Playback progress")}
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
              aria-label={isPlaying ? t("Pause") : status === "paused" ? t("Resume") : t("Play briefing")}
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
              {status === "loading" && t("Generating voice…")}
              {status === "playing" && t("Playing briefing")}
              {status === "paused" && t("Paused")}
              {status === "ended" && t("Finished. Press play to hear it again.")}
              {(status === "idle" || status === "error") && t("Press play to hear a plain-language briefing")}
            </div>
            <button type="button" className="icon-btn" aria-label={t("Restart")} onClick={restart} disabled={status === "idle"}>
              <RotateCcw size={18} />
            </button>
          </div>
          {!spokenInLocale && (
            <p className="player__note" role="note">
              {t("The audio briefing plays in English; voices for this language aren't available yet.")}
            </p>
          )}
          {error && (
            <p className="player__error" role="status">
              {t(error)}
            </p>
          )}
          {!mode && status === "idle" && (
            <p className="player__error" role="status">
              {t("Audio isn't available in this browser. Read the summary below.")}
            </p>
          )}
        </div>

        <div className="drawer__body">
          <section className="transcript">
            <h3 className="transcript__heading">
              <FileText size={14} aria-hidden="true" /> {t("In plain language")}
            </h3>
            <Tx as="p" text={service.plainLanguage} />
          </section>
          <section className="transcript">
            <h3 className="transcript__heading">{t("What you'll need")}</h3>
            <ul className="requirements-list">
              {service.requirements.map((item) => (
                <Tx key={item} as="li" text={item} />
              ))}
            </ul>
          </section>
          <p className="transcript__time">
            <Clock size={14} aria-hidden="true" /> {t(service.time)} · {t(service.agency)}
          </p>
        </div>

        <div className="drawer__footer">
          <a className="btn btn--ghost" href={service.officialUrl} target="_blank" rel="noreferrer">
            {t("Official site")} <ExternalLink size={14} aria-hidden="true" />
          </a>
          {onStartApplication && (
            <button type="button" className="btn btn--primary" onClick={() => onStartApplication(service)}>
              {t("Start application")}
            </button>
          )}
        </div>
      </aside>
    </div>
  );
};

export default ElevenLabsVoiceAssistant;
