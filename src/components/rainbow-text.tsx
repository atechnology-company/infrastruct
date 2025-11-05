"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

interface RainbowTextProps {
  text: string;
  isVisible: boolean;
  className?: string;
}

export function RainbowText({
  text,
  isVisible,
  className = "",
}: RainbowTextProps) {
  const [animationComplete, setAnimationComplete] = useState(false);

  // When visibility toggles on, start the quick pulse; when it turns off, reset.
  useEffect(() => {
    let t: number | undefined;
    if (isVisible) {
      setAnimationComplete(false);
      // Fallback in case animationend doesn't fire: allow two 0.5s iterations + margin
      t = window.setTimeout(() => setAnimationComplete(true), 1100);
    } else {
      setAnimationComplete(false);
    }
    return () => {
      if (t) clearTimeout(t);
    };
  }, [isVisible]);

  if (!isVisible) return null;

  const rainbowGradient =
    "linear-gradient(90deg, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #8b5cf6, #ef4444, #9CA3AF, #9CA3AF, #9CA3AF)";

  // While pulsing, show clipped rainbow text; once complete, show grey text
  // We'll render an overlay container so we can cross-fade the rainbow into grey
  // The sequence is:
  // 1) Show rainbow span with one-shot keyframe (background-position sweep)
  // 2) After timeout, animate rainbow opacity -> 0 and grey opacity -> 1

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        lineHeight: 1,
        verticalAlign: "middle",
        width: "100%",
      }}
    >
  <style>{`@keyframes infrRainbowPulse { from { background-position: 0% 50%; } to { background-position: 200% 50%; } }`}</style>

      {/* Rainbow layer: present initially; fades out when animationComplete becomes true */}
      <motion.span
        aria-hidden
        initial={{ y: 6, opacity: 0 }}
        animate={{ y: 0, opacity: animationComplete ? 0 : 1 }}
        transition={{ y: { duration: 0.28, ease: [0.4, 0, 0.2, 1] }, opacity: { duration: 0.25 } }}
        onAnimationEnd={() => setAnimationComplete(true)}
        style={{
          display: "inline-block",
          position: "absolute",
          inset: 0,
          backgroundImage: rainbowGradient,
          // larger backgroundSize and single 1s linear sweep to cover two passes smoothly
          backgroundSize: "300% 100%",
          backgroundPosition: "0% 50%",
          animation: "infrRainbowPulse 1s linear forwards",
          zIndex: 20,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        {text}
      </motion.span>

      {/* Grey layer: hidden initially; fades in when animationComplete becomes true */}
        <motion.span
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: animationComplete ? 1 : 0, y: 0 }}
          transition={{ duration: 0.25 }}
          style={{ display: "inline-block", color: "#9CA3AF", position: "relative", zIndex: 10 }}
        >
          {text}
        </motion.span>
    </span>
  );
}
