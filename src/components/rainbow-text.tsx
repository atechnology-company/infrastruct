"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

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

  useEffect(() => {
    if (isVisible && !animationComplete) {
      const timer = setTimeout(() => setAnimationComplete(true), 1600);
      return () => clearTimeout(timer);
    }
  }, [isVisible, animationComplete]);

  if (!isVisible) return null;

  return (
    <motion.div
      className={className}
      initial={{
        background: "linear-gradient(90deg, #6b7280 0%, #6b7280 100%)",
        backgroundSize: "400% 100%",
        backgroundPosition: "0% 50%",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        opacity: 1,
      }}
      animate={
        animationComplete
          ? {
              background: "linear-gradient(90deg, #6b7280 0%, #6b7280 100%)",
              backgroundPosition: "0% 50%",
              opacity: 1,
            }
          : {
              background: [
                "linear-gradient(90deg, #6b7280 0%, #6b7280 100%)",
                "linear-gradient(90deg, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #8b5cf6, #ef4444)",
                "linear-gradient(90deg, #6b7280 0%, #6b7280 100%)",
              ],
              backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
              opacity: [1, 1, 1, 0.5, 1],
            }
      }
      transition={{
        duration: 1.6,
        ease: [0.4, 0, 0.2, 1],
      }}
      style={{
        display: "inline-block",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
      }}
    >
      {text}
    </motion.div>
  );
}
