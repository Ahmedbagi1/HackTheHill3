import { useEffect, useRef } from "react";

const BAR_COUNT = 36;

/**
 * Canvas audio visualiser. With an AnalyserNode it draws the live frequency
 * spectrum; otherwise it animates a synthetic voice-like pattern while active.
 */
const Waveform = ({ analyser, active, live }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    const data = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let raf = 0;
    // If the analyser reports pure silence while playing (muted output device,
    // headless browsers), fall back to the synthetic animation.
    let silentFrames = 0;

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const { width, height } = canvas.getBoundingClientRect();
      const color = getComputedStyle(canvas).getPropertyValue("--wave-color").trim() || "#4f46e5";
      ctx.clearRect(0, 0, width, height);

      const gap = 3;
      const barWidth = (width - gap * (BAR_COUNT - 1)) / BAR_COUNT;
      let useSpectrum = false;
      if (live && analyser && active) {
        analyser.getByteFrequencyData(data);
        silentFrames = data.some((v) => v > 0) ? 0 : silentFrames + 1;
        useSpectrum = silentFrames < 20;
      }

      for (let i = 0; i < BAR_COUNT; i++) {
        let level;
        if (!active) {
          level = 0.08;
        } else if (useSpectrum) {
          // Skip the lowest bins (mostly rumble) and spread across the bars.
          const bin = Math.floor(2 + (i / BAR_COUNT) * (data.length * 0.7));
          level = Math.max(0.06, data[bin] / 255);
        } else {
          const t = frame / 9;
          const envelope = 0.55 + 0.45 * Math.sin(t / 3.1);
          level = 0.12 + 0.6 * envelope * Math.abs(Math.sin(t + i * 0.55) * Math.cos(t * 0.37 + i * 0.21));
        }
        const barHeight = Math.max(3, level * height);
        const x = i * (barWidth + gap);
        const y = (height - barHeight) / 2;
        ctx.globalAlpha = active ? 0.55 + level * 0.45 : 0.35;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, barWidth / 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      frame += 1;
      if (active && !reduceMotion) raf = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [analyser, active, live]);

  return <canvas ref={canvasRef} className="waveform" aria-hidden="true" />;
};

export default Waveform;
