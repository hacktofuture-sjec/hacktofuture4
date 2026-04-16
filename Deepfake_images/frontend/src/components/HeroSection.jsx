import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Sparkles } from 'lucide-react';

const HeroSection = () => {
  return (
    <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: 'easeOut' }}
        className="text-center mb-16 relative"
    >
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[200px] bg-neonCyan/10 blur-[100px] rounded-full pointer-events-none" />
      
      <motion.div 
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        transition={{ duration: 1.5, repeat: Infinity, repeatType: "reverse" }}
        className="mx-auto w-16 h-16 bg-cyberPanel border border-neonCyan rounded-xl mb-6 flex items-center justify-center shadow-[0_0_15px_rgba(0,245,255,0.3)] relative"
      >
          <div className="absolute inset-0 bg-neonCyan/20 animate-ping rounded-xl"></div>
          <Shield className="text-neonCyan w-8 h-8" />
      </motion.div>

      <h1 className="font-orbitron text-5xl md:text-7xl font-black tracking-tighter mb-4 text-white uppercase relative z-10 leading-tight">
        <span className="relative inline-block">
          Agentic
          <span className="absolute -top-4 -right-8 text-xs font-mono text-neonCyan/40 animate-pulse hidden md:block">VER: 3.0.42</span>
        </span> 
        <br />
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-neonCyan via-white to-neonPurple animate-neon-flicker drop-shadow-[0_0_15px_rgba(0,245,255,0.5)]">
          AI Deepfake
        </span> 
        <br />
        Detector
      </h1>
      
      <div className="flex flex-col items-center gap-2">
        <p className="font-rajdhani text-2xl text-neonCyan/70 tracking-[0.2em] uppercase font-semibold relative z-10 flex items-center justify-center gap-3">
           Decoding Truth In A Synthetic Reality <Sparkles className="w-5 h-5 text-neonPurple animate-pulse" />
        </p>
        <div className="h-[1px] w-48 bg-gradient-to-r from-transparent via-neonCyan/50 to-transparent"></div>
        <p className="text-[10px] font-mono text-white/30 tracking-[0.5em] uppercase mt-2">
          Neural Architecture // Forensic Intelligence // Real-time Verification
        </p>
      </div>
    </motion.header>
  );
};

export default HeroSection;
