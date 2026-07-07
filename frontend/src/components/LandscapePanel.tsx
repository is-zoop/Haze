import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import loginLandscape from "../assets/images/login_right_landscape_hd.png";

interface LandscapePanelProps {
  enableMagnifier?: boolean;
}

export function LandscapePanel({ enableMagnifier = false }: LandscapePanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    
    // Calculate mouse coordinates relative to the panel container
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setMousePos({ x, y });
  };

  const imageSrc = loginLandscape;
  const lensSize = 80; // Diameter of the lens in pixels
  const zoomLevel = 2.2; // Magnification factor

  // Calculate percentage coordinates of mouse for background positioning inside the magnifier
  const percentageX = containerRef.current ? (mousePos.x / containerRef.current.offsetWidth) * 100 : 50;
  const percentageY = containerRef.current ? (mousePos.y / containerRef.current.offsetHeight) * 100 : 50;

  const showLens = isHovered && enableMagnifier;

  return (
    <div 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative w-full h-full overflow-hidden flex items-center justify-center bg-[#F4F4F4] ${showLens ? "cursor-none" : ""}`}
    >
      {/* Decorative Outer Border Shadow for Impasto Canvas feel */}
      <div className="absolute inset-0 bg-[#F4F4F4]" />

      <motion.div
        className="w-full h-full relative"
        initial={{ opacity: 0, scale: 1.05 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <img
          src={imageSrc}
          alt="Haze AI Platform Scenic Impasto Landscape"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover select-none pointer-events-none"
        />

        {/* Ambient Overlay to integrate with the elegant off-white card border */}
        <div className="absolute inset-0 bg-black/1 pointer-events-none shadow-inner" />
      </motion.div>

      {/* Interactive Magnifying Glass Loupe */}
      <AnimatePresence>
        {showLens && containerRef.current && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="absolute rounded-full pointer-events-none z-30 overflow-hidden border-2 border-white/95 shadow-[0_20px_50px_rgba(0,0,0,0.35)]"
            style={{
              width: lensSize,
              height: lensSize,
              left: mousePos.x - lensSize / 2,
              top: mousePos.y - lensSize / 2,
              // Setup magnified background image using the calculated percentages
              backgroundImage: `url(${imageSrc})`,
              backgroundRepeat: "no-repeat",
              backgroundSize: `${containerRef.current.offsetWidth * zoomLevel}px ${containerRef.current.offsetHeight * zoomLevel}px`,
              backgroundPosition: `${percentageX}% ${percentageY}%`,
            }}
          >
            {/* Elegant physical convex glass gloss reflection/ring highlight */}
            <div className="absolute inset-0 rounded-full border border-black/10 pointer-events-none" />
            
            {/* Subtle light arc gloss effect on upper right */}
            <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_25%,rgba(255,255,255,0.25)_0%,transparent_50%)] pointer-events-none" />
            
            {/* Soft inner shadowing for structural convex depth */}
            <div className="absolute inset-0 rounded-full shadow-[inset_0_4px_15px_rgba(0,0,0,0.25)] pointer-events-none" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

