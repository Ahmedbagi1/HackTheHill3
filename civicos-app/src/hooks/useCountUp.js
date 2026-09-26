import { useEffect, useState } from "react";

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Animates a number from 0 to `target` (ease-out). Shows the final value under reduced motion. */
export function useCountUp(target, duration = 1100) {
  const [value, setValue] = useState(0);
  const reduceMotion = prefersReducedMotion();

  useEffect(() => {
    if (reduceMotion) return undefined;
    let raf = 0;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      setValue(Math.round(target * (1 - (1 - t) ** 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, reduceMotion]);

  return reduceMotion ? target : value;
}
