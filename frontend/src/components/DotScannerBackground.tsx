import { motion } from "motion/react";

export function DotScannerBackground() {
  const duration = 6.0; // The sweep movement takes 6 seconds
  const repeatDelay = 4.0; // Rest for 4 seconds to achieve exactly 10s cycles
  const ease = "easeInOut";

  return (
    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden" id="scanner-bg">
      {/* 1. Ambient Background Blobs (Breathing) */}
      <motion.div
        animate={{
          scale: [1, 1.15, 0.95, 1.1, 1],
          x: [0, 30, -20, 15, 0],
          y: [0, -20, 40, -10, 0],
          opacity: [0.4, 0.55, 0.45, 0.6, 0.4],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          repeatType: "mirror",
          ease: "easeInOut",
        }}
        className="absolute -top-[10%] -left-[10%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] rounded-full bg-sky-200/50 blur-[100px]"
      />

      <motion.div
        animate={{
          scale: [1, 1.2, 0.9, 1.15, 1],
          x: [0, -40, 30, -15, 0],
          y: [0, 30, -30, 20, 0],
          opacity: [0.35, 0.5, 0.4, 0.55, 0.35],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          repeatType: "mirror",
          ease: "easeInOut",
        }}
        className="absolute -bottom-[15%] -right-[10%] w-[60vw] h-[60vw] max-w-[700px] max-h-[700px] rounded-full bg-blue-300/30 blur-[120px]"
      />

      <motion.div
        animate={{
          scale: [0.95, 1.1, 0.95],
          opacity: [0.6, 0.9, 0.6],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          repeatType: "mirror",
          ease: "easeInOut",
        }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70vw] h-[50vw] max-w-[800px] rounded-full bg-white/70 blur-[80px]"
      />

      {/* 2. Base Grid of Squares with Intersection Dot Matrix (Soft grey & highly transparent/low opacity) */}
      <div 
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: `
            radial-gradient(circle at 1px 1px, #94a3b8 1px, transparent 1px),
            linear-gradient(to right, #cbd5e1 0.8px, transparent 0.8px),
            linear-gradient(to bottom, #cbd5e1 0.8px, transparent 0.8px)
          `,
          backgroundSize: "4rem 4rem",
          maskImage: "radial-gradient(ellipse 65% 55% at 50%_50%, #000 80%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 65% 55% at 50%_50%, #000 80%, transparent 100%)",
        }}
      />

      {/* 3. Sweeping Scanner Light Highlight Layer (From Left to Right) */}
      <div 
        className="absolute inset-0 z-10"
        style={{
          maskImage: "radial-gradient(ellipse 65% 55% at 50%_50%, #000 80%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 65% 55% at 50%_50%, #000 80%, transparent 100%)",
        }}
      >
        {/* The moving Scanner Light Beam - Subtle, warm/light grey-blue sweep */}
        <motion.div
          animate={{
            x: ["-100vw", "100vw"],
          }}
          transition={{
            duration,
            repeat: Infinity,
            repeatDelay,
            ease,
          }}
          className="absolute top-0 bottom-0 w-[40vw] bg-[linear-gradient(to_right,transparent,rgba(148,163,184,0.005),rgba(148,163,184,0.03),rgba(148,163,184,0.005),transparent)] blur-xs"
          style={{
            mixBlendMode: "color-dodge",
          }}
        />

        {/* Illuminated active dots that light up when the scanner sweeps over. */}
        <motion.div
          animate={{
            x: ["-100vw", "100vw"],
          }}
          transition={{
            duration,
            repeat: Infinity,
            repeatDelay,
            ease,
          }}
          className="absolute top-0 bottom-0 w-[40vw] overflow-hidden"
        >
          {/* Symmetrical reverse translation to keep dots completely static relative to screen,
              acting as a highly optimized scanner window */}
          <motion.div
            animate={{
              x: ["100vw", "-100vw"],
            }}
            transition={{
              duration,
              repeat: Infinity,
              repeatDelay,
              ease,
            }}
            className="absolute inset-x-0 inset-y-0 w-[100vw]"
            style={{
              backgroundImage: `
                radial-gradient(circle at 1px 1px, #94a3b8 1px, transparent 1px),
                linear-gradient(to right, #94a3b8 0.8px, transparent 0.8px),
                linear-gradient(to bottom, #94a3b8 0.8px, transparent 0.8px)
              `,
              backgroundSize: "4rem 4rem",
              opacity: 0.1,
            }}
          />
        </motion.div>
      </div>
    </div>
  );
}
