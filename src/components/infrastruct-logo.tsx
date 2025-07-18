"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

const SHAPE_SIZE = 32; // px (smaller, just a bit bigger than text)

export function InfrastructLogo() {
  const [isHovered, setIsHovered] = useState(false);
  const [randomValues, setRandomValues] = useState<{ [key: string]: number }>(
    {},
  );

  const generateRandomValues = () => {
    const values: { [key: string]: number } = {};
    // Animate shapes
    for (let i = 1; i <= 4; i++) {
      values[`rotate${i}`] = Math.floor(Math.random() * 201) - 100;
      values[`x${i}`] = Math.floor(Math.random() * 41) - 20;
      values[`y${i}`] = Math.floor(Math.random() * 41) - 20;
    }
    // Animate each letter
    for (let i = 0; i < letters.length; i++) {
      values[`rotate${i + 5}`] = Math.floor(Math.random() * 61) - 30;
      values[`x${i + 5}`] = Math.floor(Math.random() * 21) - 10;
      values[`y${i + 5}`] = Math.floor(Math.random() * 21) - 10;
    }
    setRandomValues(values);
  };

  useEffect(() => {
    if (isHovered) {
      generateRandomValues();
    }
  }, [isHovered]);

  // Diamond size so its diagonal matches SHAPE_SIZE
  const diamondSize = Math.round(SHAPE_SIZE / Math.sqrt(2));

  const letters = "Infrastruct".split("");

  return (
    <div className="flex flex-row gap-5 items-center">
      <div
        className="cursor-pointer select-none"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(2, ${SHAPE_SIZE}px)`,
          gridTemplateRows: `repeat(2, ${SHAPE_SIZE}px)`,
          gap: 0,
          width: SHAPE_SIZE * 2,
          height: SHAPE_SIZE * 2,
        }}
      >
        {/* Circle */}
        <motion.div
          style={{
            width: SHAPE_SIZE,
            height: SHAPE_SIZE,
            borderRadius: "50%",
            background: "#fff",
            gridColumn: 1,
            gridRow: 1,
          }}
          animate={
            isHovered
              ? {
                  rotate: randomValues["rotate1"] || 0,
                  x: randomValues["x1"] || 0,
                  y: randomValues["y1"] || 0,
                  backgroundColor: "#ef4444",
                }
              : {
                  rotate: 0,
                  x: 0,
                  y: 0,
                  backgroundColor: "#fff",
                }
          }
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
        {/* Triangle */}
        <motion.div
          style={{
            width: SHAPE_SIZE,
            height: SHAPE_SIZE,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            gridColumn: 2,
            gridRow: 1,
          }}
          animate={
            isHovered
              ? {
                  rotate: randomValues["rotate2"] || 0,
                  x: randomValues["x2"] || 0,
                  y: randomValues["y2"] || 0,
                }
              : {
                  rotate: 0,
                  x: 0,
                  y: 0,
                }
          }
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <motion.div
            style={{
              width: 0,
              height: 0,
              borderLeft: `${SHAPE_SIZE / 2}px solid transparent`,
              borderRight: `${SHAPE_SIZE / 2}px solid transparent`,
              borderBottom: `${SHAPE_SIZE}px solid`,
            }}
            animate={
              isHovered
                ? { borderBottomColor: "#3b82f6" }
                : { borderBottomColor: "#fff" }
            }
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
        </motion.div>
        {/* Square */}
        <motion.div
          style={{
            width: SHAPE_SIZE,
            height: SHAPE_SIZE,
            background: "#fff",
            gridColumn: 1,
            gridRow: 2,
          }}
          animate={
            isHovered
              ? {
                  rotate: randomValues["rotate3"] || 0,
                  x: randomValues["x3"] || 0,
                  y: randomValues["y3"] || 0,
                  backgroundColor: "#10b981",
                }
              : {
                  rotate: 0,
                  x: 0,
                  y: 0,
                  backgroundColor: "#fff",
                }
          }
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
        {/* Diamond */}
        <motion.div
          style={{
            width: diamondSize,
            height: diamondSize,
            background: "#fff",
            transform: "rotate(45deg)",
            margin: `${(SHAPE_SIZE - diamondSize) / 2}px`,
            gridColumn: 2,
            gridRow: 2,
          }}
          animate={
            isHovered
              ? {
                  rotate: randomValues["rotate4"] || 45,
                  x: randomValues["x4"] || 0,
                  y: randomValues["y4"] || 0,
                  backgroundColor: "#f59e0b",
                }
              : {
                  rotate: 45,
                  x: 0,
                  y: 0,
                  backgroundColor: "#fff",
                }
          }
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
      </div>
      {/* Text */}
      <div className="flex">
        {letters.map((letter, index) => (
          <motion.span
            key={index}
            className="text-4xl font-light text-white"
            animate={
              isHovered
                ? {
                    x: randomValues[`x${index + 5}`] || 0,
                    y: randomValues[`y${index + 5}`] || 0,
                    rotate: randomValues[`rotate${index + 5}`] || 0,
                  }
                : {
                    x: 0,
                    y: 0,
                    rotate: 0,
                  }
            }
            transition={{
              duration: 0.3,
              ease: "easeOut",
              delay: index * 0.02,
            }}
          >
            {letter}
          </motion.span>
        ))}
      </div>
    </div>
  );
}
