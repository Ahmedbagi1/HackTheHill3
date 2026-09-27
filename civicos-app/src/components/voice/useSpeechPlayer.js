import { useCallback, useEffect, useRef, useState } from "react";
import { browserSpeechAvailable, getVoiceStatus, synthesizeSpeech } from "../../services/api/elevenLabsClient";

/**
 * Plays a script with ElevenLabs when the /api/tts proxy is configured,
 * otherwise with the browser's speechSynthesis ("simulated" mode).
 *
 * Exposes an AnalyserNode for live ElevenLabs audio so the waveform reflects
 * the real signal; browser speech can't be analysed, so the waveform animates.
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

  const ensureAudioGraph = () => {
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
    audioRef.current = audio;

    const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
    if (AudioContextClass) {
      const context = new AudioContextClass();
      const source = context.createMediaElementSource(audio);
      const node = context.createAnalyser();
      node.fftSize = 128;
      node.smoothingTimeConstant = 0.75;
      source.connect(node);
      node.connect(context.destination);
      audioContextRef.current = context;
      setAnalyser(node);
    }
    return audio;
  };

  const speakWithBrowser = () => {
    if (!browserSpeechAvailable()) {
      setError("Audio playback isn't supported in this browser.");
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

  const play = async () => {
    setError(null);

    if (status === "paused") {
      if (mode === "elevenlabs") {
        await audioContextRef.current?.resume();
        await audioRef.current.play();
      } else {
        window.speechSynthesis.resume();
      }
      setStatus("playing");
      return;
    }

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
      const audio = ensureAudioGraph();
      await audioContextRef.current?.resume();
      const url = await synthesizeSpeech(text, { cacheKey, signal: controller.signal });
      if (audio.src !== url) audio.src = url;
      audio.currentTime = 0;
      setMode("elevenlabs");
      await audio.play();
      setStatus("playing");
    } catch (err) {
      if (err.name === "AbortError") return;
      // Keep the citizen informed but still deliver the explanation.
      setError(`ElevenLabs unavailable (${err.message}). Using the browser voice instead.`);
      speakWithBrowser();
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
