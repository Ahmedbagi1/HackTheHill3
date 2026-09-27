import { useCallback, useEffect, useRef, useState } from "react";
import { browserSpeechAvailable, getVoiceStatus, synthesizeSpeech } from "../../services/api/elevenLabsClient";

/**
 * Plays a script with ElevenLabs when the /api/tts proxy is configured,
 * otherwise with the browser's speechSynthesis ("simulated" mode).
 *
 * Exposes an AnalyserNode for live ElevenLabs audio so the waveform reflects
 * the real signal; browser speech can't be analysed, so the waveform animates.
 *
 * Failure handling: every ElevenLabs failure is logged and surfaced. Audio is
 * routed through the analyser only when its AudioContext is running (a
 * suspended context would mute playback), blocked autoplay waits for another
 * press instead of failing, and decode or network errors fall back to the
 * browser voice.
 */
export function useSpeechPlayer({ text, cacheKey, lang = "en-CA" }) {
  const [status, setStatus] = useState("idle"); // idle | loading | playing | paused | ended | error
  const [mode, setMode] = useState(null); // "elevenlabs" | "browser" | null
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [analyser, setAnalyser] = useState(null);

  const audioRef = useRef(null);
  const audioContextRef = useRef(null);
  const utteranceRef = useRef(null);
  const abortRef = useRef(null);
  const fallbackRef = useRef(null);

  // Detect the mode up front so the UI can label it before playback.
  useEffect(() => {
    let active = true;
    getVoiceStatus().then((voice) => {
      if (active) setMode(voice.enabled ? "elevenlabs" : browserSpeechAvailable() ? "browser" : null);
    });
    return () => {
      active = false;
    };
  }, []);

  const stopAll = useCallback(() => {
    abortRef.current?.abort();
    audioRef.current?.pause();
    if (browserSpeechAvailable()) window.speechSynthesis.cancel();
  }, []);

  // Callers remount per script (key={service.id}); tear everything down on unmount.
  useEffect(
    () => () => {
      stopAll();
      audioContextRef.current?.close().catch(() => {});
    },
    [stopAll],
  );

  // Must start inside the click handler: browsers only let a user gesture
  // resume an AudioContext.
  const ensureAudioGraph = async () => {
    if (audioRef.current) return audioRef.current;

    const audio = new Audio();
    audio.preload = "auto";
    audio.addEventListener("timeupdate", () => {
      if (audio.duration) setProgress(audio.currentTime / audio.duration);
    });
    audio.addEventListener("ended", () => {
      setProgress(1);
      setStatus("ended");
    });
    audio.addEventListener("error", () => {
      if (!audio.getAttribute("src")) return;
      console.error("[voice] ElevenLabs audio could not be decoded or loaded.", audio.error);
      fallbackRef.current?.("The ElevenLabs audio couldn't be played. Using the browser voice instead.");
    });
    audioRef.current = audio;

    const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
    if (AudioContextClass) {
      try {
        const context = new AudioContextClass();
        if (context.state !== "running") await context.resume().catch(() => {});
        if (context.state === "running") {
          const source = context.createMediaElementSource(audio);
          const node = context.createAnalyser();
          node.fftSize = 128;
          node.smoothingTimeConstant = 0.75;
          source.connect(node);
          node.connect(context.destination);
          audioContextRef.current = context;
          setAnalyser(node);
        } else {
          // Play straight from the element; the waveform animates instead.
          console.warn("[voice] AudioContext is suspended; playing without the live waveform.");
          context.close().catch(() => {});
        }
      } catch (err) {
        console.warn("[voice] Live waveform unavailable.", err);
      }
    }
    return audio;
  };

  const speakWithBrowser = () => {
    if (!browserSpeechAvailable()) {
      setError("Audio isn't available in this browser. Read the summary below.");
      setStatus("error");
      return;
    }
    const synth = window.speechSynthesis;
    synth.cancel();

    const voices = synth.getVoices();
    const base = lang.split("-")[0];
    const voice = voices.find((v) => v.lang === lang) ?? voices.find((v) => v.lang.startsWith(base));

    // Queue sentence-sized chunks: some engines (e.g. Chrome's cloud voices)
    // silently stop long utterances after ~15 seconds.
    const sentences = text.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [text];
    let offset = 0;
    const utterances = sentences.map((sentence, index) => {
      const start = offset;
      offset += sentence.length;
      const utterance = new SpeechSynthesisUtterance(sentence.trim());
      utterance.lang = lang;
      utterance.rate = 0.98;
      if (voice) utterance.voice = voice;
      utterance.onboundary = (event) => setProgress(Math.min(1, (start + event.charIndex) / text.length));
      utterance.onend = () => {
        const isLast = index === sentences.length - 1;
        setProgress(isLast ? 1 : Math.min(1, (start + sentence.length) / text.length));
        if (isLast) setStatus("ended");
      };
      utterance.onerror = (event) => {
        if (event.error === "canceled" || event.error === "interrupted") return;
        setError("The browser voice stopped unexpectedly.");
        setStatus("error");
      };
      return utterance;
    });

    utteranceRef.current = utterances;
    setMode("browser");
    setStatus("playing");
    setProgress(0);
    utterances.forEach((utterance) => synth.speak(utterance));
  };

  const fallBackToBrowser = (message) => {
    audioRef.current?.pause();
    setError(message);
    speakWithBrowser();
  };
  // The audio element's error listener is attached once; keep it pointed at the latest closure.
  useEffect(() => {
    fallbackRef.current = fallBackToBrowser;
  });

  const startElement = async (audio) => {
    try {
      await audioContextRef.current?.resume();
      await audio.play();
      setStatus("playing");
    } catch (err) {
      if (err.name === "NotAllowedError") {
        // Synthesis outlived the click's permission to play. The audio is
        // loaded; one more press starts it.
        console.warn("[voice] Autoplay was blocked; waiting for another press.");
        setMode("elevenlabs");
        setStatus("paused");
        setError("Your browser paused the audio. Press play to start it.");
        return;
      }
      throw err;
    }
  };

  const play = async () => {
    setError(null);

    if (status === "paused") {
      if (mode === "elevenlabs" && audioRef.current) {
        try {
          await startElement(audioRef.current);
        } catch (err) {
          console.error("[voice] ElevenLabs playback failed.", err);
          fallBackToBrowser("The ElevenLabs audio couldn't be played. Using the browser voice instead.");
        }
      } else {
        window.speechSynthesis.resume();
        setStatus("playing");
      }
      return;
    }

    // Start the audio graph before awaiting anything, while the click still counts.
    const audioReady = mode === "browser" ? null : ensureAudioGraph();
    const voice = await getVoiceStatus();
    if (!voice.enabled) {
      speakWithBrowser();
      return;
    }

    setStatus("loading");
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const audio = await (audioReady ?? ensureAudioGraph());
      const url = await synthesizeSpeech(text, { cacheKey, signal: controller.signal });
      if (audio.src !== url) audio.src = url;
      audio.currentTime = 0;
      setMode("elevenlabs");
      await startElement(audio);
    } catch (err) {
      if (err.name === "AbortError") return;
      console.error("[voice] ElevenLabs unavailable; using the browser voice.", err);
      // Keep the citizen informed but still deliver the explanation.
      fallBackToBrowser(`ElevenLabs unavailable (${err.message}). Using the browser voice instead.`);
    }
  };

  const pause = () => {
    if (mode === "elevenlabs") audioRef.current?.pause();
    else window.speechSynthesis.pause();
    setStatus("paused");
  };

  const restart = () => {
    stopAll();
    setProgress(0);
    setStatus("idle");
  };

  return { status, mode, progress, error, analyser, play, pause, restart };
}
