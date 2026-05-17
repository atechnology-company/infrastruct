"use client";

import { useEffect, useRef, useState } from "react";

export function useSmoothProgress(target: number, enabled: boolean): number {
  const [display, setDisplay] = useState(0);
  const displayRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      displayRef.current = 0;
      setDisplay(0);
      return;
    }

    const goal = Math.max(displayRef.current, Math.min(100, target));
    if (goal <= displayRef.current) return;

    let raf = 0;
    const tick = () => {
      const current = displayRef.current;
      if (current >= goal) return;
      const step = Math.max(0.35, (goal - current) * 0.12);
      const next = Math.min(goal, current + step);
      displayRef.current = next;
      setDisplay(next);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, enabled]);

  return enabled ? display : 0;
}
