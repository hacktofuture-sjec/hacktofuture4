import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BrainCircuit, Sparkles, Terminal, Activity, ChevronRight } from 'lucide-react';

const LLMExplanationPanel = ({ explanation, explaining }) => {
  const [displayedText, setDisplayedText] = useState("");
  const [showCursor, setShowCursor] = useState(true);
  const containerRef = useRef(null);
  
  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 500);
    return () => clearInterval(cursorInterval);
  }, []);

  useEffect(() => {
    if (!explanation) {
      setDisplayedText("");
      return;
    }
    
    // Typewriter effect
    let i = 0;
    setDisplayedText("");
    
    // Split into characters for smooth typing
    const chars = explanation.split("");
    
    const intervalId = setInterval(() => {
      if (i < chars.length) {
        setDisplayedText((prev) => prev + chars[i]);
        i++;
        
        // Auto-scroll to bottom
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
      } else {
        clearInterval(intervalId);
      }
    }, 10); // slightly faster for responsiveness
    
    return () => clearInterval(intervalId);
  }, [explanation]);

  // Dynamic keyword highlighting implementation
  const formatText = (text) => {
    if (!text) return null;
    
    const words = text.split(' ');
    return words.map((word, idx) => {
      const lower = word.toLowerCase();
      
      // Detection terms
      if (lower.includes('fake') || lower.includes('synthetic') || lower.includes('manipulat') || lower.includes('generated')) {
        return <span key={idx} className="text-neonRed font-bold text-glow-red mx-[2px]">{word}</span>;
      }
      
      // Technical/Forensic terms
      if (lower.includes('noise') || lower.includes('artifact') || lower.includes('inconsist') || lower.includes('pixel') || lower.includes('frequency')) {
        return <span key={idx} className="text-neonPurple font-bold mx-[2px]">{word}</span>;
      }
      
      // Positive/Authentic terms
      if (lower.includes('authentic') || lower.includes('real') || lower.includes('verified') || lower.includes('organic')) {
        return <span key={idx} className="text-neonGreen font-bold text-glow-green mx-[2px]">{word}</span>;
      }
      
      // Confidence/Meta terms
      if (lower.includes('confidence') || lower.includes('probability') || lower.includes('model') || lower.includes('consensus')) {
        return <span key={idx} className="text-neonCyan font-bold mx-[2px] italic">{word}</span>;
      }

      return <span key={idx} className="mx-[1px]">{word}</span>;
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel p-1 rounded-2xl relative overflow-hidden group border-neonCyan/20"
    >
      {/* Container Inner Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-cyberPanel/90 to-cyberBase/95 pointer-events-none rounded-xl" />
      
      {/* Scanline overlay specifically for this panel */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,245,255,0.02)_1px,transparent_1px)] bg-[size:100%_4px] pointer-events-none z-0" />

      <div className="relative z-10 p-6 md:p-8 rounded-xl h-full flex flex-col">
        
        {/* Header HUD */}
        <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
          <div className="flex items-center gap-4">
             <div className="bg-neonCyan/10 p-2.5 rounded-lg border border-neonCyan/30 flex-shrink-0">
               <BrainCircuit className="w-6 h-6 text-neonCyan drop-shadow-[0_0_8px_#00f5ff]" />
             </div>
             <div>
               <h2 className="text-xl font-black font-orbitron text-white tracking-[0.1em] uppercase">
                 AI Summary Report
               </h2>
               <div className="flex items-center gap-2 mt-0.5">
                  <div className="flex gap-0.5">
                     {[1,2,3].map(i => <div key={i} className="w-1.5 h-1 bg-neonCyan/30 rounded-full animate-pulse" style={{ animationDelay: `${i*0.2}s` }} />)}
                  </div>
                  <p className="text-[9px] text-neonCyan/50 font-mono uppercase tracking-widest">
                    AI AGENT: DEEPTRUST // GROQ Llama-3 70B
                  </p>
               </div>
             </div>
          </div>
          <div className="hidden md:flex items-center gap-4 font-mono text-[9px] text-white/20 uppercase tracking-tighter">
             <div className="flex items-center gap-1">
                <Activity className="w-3 h-3" /> <span>LATENCY: 42MS</span>
             </div>
             <div className="flex items-center gap-1">
                <Terminal className="w-3 h-3" /> <span>OPS: 1.2 TFLOPS</span>
             </div>
          </div>
        </div>

        {/* Content Box */}
        <div 
          ref={containerRef}
          className="relative flex-grow min-h-[300px] max-h-[500px] bg-black/40 rounded-xl p-6 overflow-y-auto font-rajdhani text-lg leading-relaxed border border-white/5 shadow-inner custom-scrollbar"
        >
          <AnimatePresence mode="wait">
            {explaining ? (
              <motion.div 
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center h-full space-y-4 py-20"
              >
                <div className="relative">
                   <div className="w-16 h-16 border-4 border-neonCyan/20 border-t-neonCyan rounded-full animate-spin"></div>
                   <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-8 h-8 bg-neonCyan/10 rounded-full animate-pulse"></div>
                   </div>
                </div>
                <div className="flex flex-col items-center gap-1">
                   <p className="font-orbitron text-neonCyan text-xs tracking-[0.3em] uppercase animate-pulse">Deconstructing Evidence</p>
                   <p className="font-mono text-white/30 text-[9px] uppercase">Retrieving model consensus...</p>
                </div>
              </motion.div>
            ) : displayedText ? (
              <motion.div 
                key="content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="relative whitespace-pre-wrap pb-4"
              >
                <div className="absolute -left-2 top-0 text-neonCyan opacity-50"><ChevronRight className="w-4 h-4" /></div>
                {formatText(displayedText)}
                {showCursor && (
                  <span className="inline-block w-2 h-5 bg-neonCyan/80 ml-1 translate-y-1 shadow-[0_0_10px_#00f5ff]"></span>
                )}
              </motion.div>
            ) : (
              <div className="h-full flex items-center justify-center">
                 <p className="text-white/20 font-mono text-xs uppercase tracking-[0.3em]">System Standby // Waiting for Data Vector</p>
              </div>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-4 flex items-center justify-between">
           <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-neonGreen animate-pulse"></div>
              <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest">Reasoning engine online</span>
           </div>
           <span className="text-[9px] font-mono text-white/20 uppercase tracking-tighter italic">End of transmission // encrypted_link_secure</span>
        </div>
      </div>
    </motion.div>
  );
};

export default LLMExplanationPanel;
