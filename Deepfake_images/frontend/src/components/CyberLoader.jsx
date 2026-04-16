import React from 'react';
import { motion } from 'framer-motion';

const CyberLoader = () => {
  return (
    <div className="relative w-full h-full flex items-center justify-center pointer-events-none">
      {/* Outer rotating ring */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        className="absolute w-48 h-48 border-2 border-dashed border-neonCyan/30 rounded-full"
      />
      
      {/* Middle hex ring */}
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        className="absolute w-32 h-32 border border-neonPurple/40 rounded-lg flex items-center justify-center"
      >
         <div className="w-full h-full border border-neonPurple/20 rotate-45" />
      </motion.div>

      {/* Inner scanning core */}
      <div className="relative w-20 h-20">
        <motion.div
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.5, 1, 0.5],
            boxShadow: [
              "0 0 20px rgba(0, 245, 255, 0.3)",
              "0 0 40px rgba(0, 245, 255, 0.6)",
              "0 0 20px rgba(0, 245, 255, 0.3)"
            ]
          }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="w-full h-full bg-neonCyan/10 rounded-full border-2 border-neonCyan flex items-center justify-center"
        >
          <div className="w-12 h-12 border border-neonCyan/50 rounded-full animate-ping" />
        </motion.div>
        
        {/* Pulsing data dots */}
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            initial={{ rotate: i * 90 }}
            animate={{ rotate: i * 90 + 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0"
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-neonCyan rounded-full shadow-[0_0_10px_#00f5ff]" />
          </motion.div>
        ))}
      </div>

      {/* SVG HUD Elements */}
      <svg className="absolute w-64 h-64 opacity-20" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="none" stroke="#00f5ff" strokeWidth="0.5" strokeDasharray="5 10" />
        <circle cx="50" cy="50" r="48" fill="none" stroke="#9d00ff" strokeWidth="0.2" />
        <path d="M 50 2 L 50 10 M 50 98 L 50 90 M 2 50 L 10 50 M 98 50 L 90 50" stroke="#00f5ff" strokeWidth="1" />
      </svg>
    </div>
  );
};

export default CyberLoader;
