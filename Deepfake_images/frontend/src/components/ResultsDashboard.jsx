import React from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, ShieldCheck, Fingerprint, Database, AlertCircle, Scan, Cpu, Layers } from 'lucide-react';

const CircularProgress = ({ percentage, colorClass, size = 120, strokeWidth = 8, label = "" }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90 drop-shadow-[0_0_10px_currentColor]">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={strokeWidth}
        />
        {/* Animated Fill */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          strokeLinecap="round"
          className={colorClass}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center flex-col">
        <span className={`text-2xl font-orbitron font-bold ${colorClass.split(' ')[0]}`}>{percentage}%</span>
        {label && <span className="text-[8px] font-mono text-white/40 uppercase tracking-tighter">{label}</span>}
      </div>
    </div>
  );
};

const GaugeMeter = ({ value, label, colorClass }) => {
  const percentage = Math.min(Math.max(value, 0), 100);
  return (
    <div className="w-full">
      <div className="flex justify-between items-end mb-1.5">
        <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">{label}</span>
        <span className={`text-sm font-orbitron font-bold ${colorClass.split(' ')[0]}`}>{value.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={`h-full ${colorClass.split(' ')[0].replace('text-', 'bg-')} shadow-[0_0_10px_currentColor]`}
        />
      </div>
    </div>
  );
};

const ResultsDashboard = ({ results }) => {
  const { detection, forensic, metadata } = results;
  const isFake = detection.prediction.toLowerCase() === 'fake';

  const verdictColor = isFake 
    ? 'text-neonRed border-neonRed/30 shadow-[0_0_40px_rgba(255,23,68,0.15)] bg-neonRed/5' 
    : 'text-neonGreen border-neonGreen/30 shadow-[0_0_40px_rgba(57,255,20,0.15)] bg-neonGreen/5';
  
  const glitchClass = isFake ? 'glitch-layer' : '';

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="grid grid-cols-1 md:grid-cols-12 gap-6"
    >
      {/* 1. DETECTION AGENT CARD - LARGE TOP LEFT */}
      <motion.div 
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className={`md:col-span-8 glass-panel p-8 rounded-2xl border-2 flex flex-col md:flex-row items-center justify-between relative overflow-hidden group ${verdictColor}`}
      >
        {/* Background scanning effect */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:30px_30px] opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-white/5 opacity-30" />
        
        <div className="flex flex-col z-10 w-full md:w-3/5 mb-6 md:mb-0">
          <div className="flex items-center gap-2 mb-4">
             <div className={`px-3 py-1 rounded border text-[10px] font-mono tracking-widest uppercase ${isFake ? 'border-neonRed text-neonRed bg-neonRed/10' : 'border-neonGreen text-neonGreen bg-neonGreen/10'}`}>
                Neural Classification
             </div>
             <div className="h-[1px] flex-grow bg-white/10"></div>
          </div>
          
          <div className="flex flex-col gap-2">
            <h1 
               data-text={isFake ? "FAKE DETECTED" : "AUTHENTIC"} 
               className={`text-4xl lg:text-6xl font-black font-orbitron tracking-tighter uppercase leading-none ${isFake ? 'text-neonRed text-glow-red' : 'text-neonGreen text-glow-green'} ${glitchClass}`}
            >
              {isFake ? "FAKE DETECTED" : "AUTHENTIC"}
            </h1>
            <p className="font-mono text-white/40 text-[10px] uppercase tracking-[0.5em] mt-2">
              Deep Neural Network Assessment Completed
            </p>
          </div>

          <div className="mt-8 flex items-center gap-6">
             <div className="flex flex-col">
                <span className="text-[10px] font-mono text-white/30 uppercase mb-1">Status</span>
                <span className={`font-orbitron font-bold text-sm ${isFake ? 'text-neonRed' : 'text-neonGreen'}`}>
                   {isFake ? "HIGH RISK" : "SECURE"}
                </span>
             </div>
             <div className="w-[1px] h-8 bg-white/10"></div>
             <div className="flex flex-col">
                <span className="text-[10px] font-mono text-white/30 uppercase mb-1">Integrity</span>
                <span className="font-orbitron font-bold text-sm text-white">
                   {isFake ? "COMPROMISED" : "VERIFIED"}
                </span>
             </div>
          </div>
        </div>

        <div className="z-10 flex flex-col items-center justify-center w-full md:w-2/5">
             <CircularProgress 
               percentage={detection.confidence} 
               colorClass={isFake ? 'text-neonRed drop-shadow-[0_0_15px_rgba(255,23,68,0.6)]' : 'text-neonGreen drop-shadow-[0_0_15px_rgba(57,255,20,0.6)]'} 
               size={160} 
               strokeWidth={12}
               label="CONFIDENCE"
             />
             <div className="mt-4 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isFake ? 'bg-neonRed animate-pulse' : 'bg-neonGreen animate-ping'}`}></div>
                <span className="text-[10px] font-mono text-white/60 uppercase tracking-widest">Confidence model alpha</span>
             </div>
        </div>
      </motion.div>

      {/* 2. FORENSIC ANALYSIS CARD - TOP RIGHT */}
      <motion.div 
        initial={{ x: 20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="md:col-span-4 glass-panel p-6 rounded-2xl relative overflow-hidden group border border-white/5"
      >
        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-30 transition-opacity">
           <Fingerprint className="w-16 h-16 text-neonPurple" />
        </div>
        
        <h3 className="text-sm text-neonPurple font-orbitron mb-6 tracking-widest flex items-center gap-3 uppercase font-bold text-glow-purple">
          <Scan className="w-4 h-4" /> Forensic Analysis
        </h3>

        <div className="space-y-6 relative z-10">
          <GaugeMeter value={forensic.forensic_score} label="Noise Inconsistency" colorClass="text-neonPurple" />
          <GaugeMeter value={forensic.artifact_score} label="Artifact Signature" colorClass="text-neonCyan" />
          <GaugeMeter value={forensic.lighting_consistency} label="Lighting Coherence" colorClass="text-neonPink" />
          
          <div className="pt-4 border-t border-white/5 flex flex-col gap-2">
             <div className="flex justify-between items-center">
                <span className="text-[10px] font-mono text-white/30 uppercase">Scan Result</span>
                <span className="text-[10px] font-mono text-neonPurple uppercase font-bold">{forensic.status}</span>
             </div>
             <div className="h-1 w-full bg-neonPurple/20 rounded-full">
                <div className="h-full bg-neonPurple shadow-[0_0_10px_#9d00ff] w-full animate-pulse-fast"></div>
             </div>
          </div>
        </div>
      </motion.div>

      {/* 3. METADATA CARD - BOTTOM LEFT */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="md:col-span-4 glass-panel p-6 rounded-2xl relative border border-white/5 group"
      >
        <h3 className="text-sm text-neonCyan font-orbitron mb-6 tracking-widest flex items-center gap-3 uppercase font-bold text-glow-cyan">
          <Database className="w-4 h-4" /> Source Metadata
        </h3>
        
        <div className="grid grid-cols-2 gap-4">
           {Object.entries(metadata).map(([key, val], idx) => (
             <div key={key} className="p-3 rounded-lg bg-white/5 border border-white/5 flex flex-col gap-1 hover:bg-white/10 transition-colors">
                <span className="text-[8px] font-mono text-white/30 uppercase tracking-tighter">{key.replace(/_/g, ' ')}</span>
                <div className="flex items-center justify-between">
                   <span className={`text-xs font-bold font-orbitron ${val === 'Present' ? 'text-neonGreen' : 'text-white/40'}`}>
                      {val}
                   </span>
                   {val === 'Present' ? <ShieldCheck className="w-3 h-3 text-neonGreen" /> : <AlertCircle className="w-3 h-3 text-white/20" />}
                </div>
             </div>
           ))}
        </div>

        <div className="mt-6 p-3 rounded bg-cyberBase border border-white/5 flex items-center gap-3">
           <Cpu className="w-4 h-4 text-neonCyan animate-pulse" />
           <span className="text-[10px] font-mono text-white/50 uppercase tracking-tighter">Agent meta-signature: verified</span>
        </div>
      </motion.div>

      {/* 4. FINAL VERDICT CARD - BOTTOM RIGHT */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className={`md:col-span-8 glass-panel p-8 rounded-2xl border-2 flex flex-col relative overflow-hidden ${verdictColor}`}
      >
        <div className="absolute top-0 right-0 p-4">
           <Layers className={`w-8 h-8 opacity-20 ${isFake ? 'text-neonRed' : 'text-neonGreen'}`} />
        </div>

        <h3 className="text-sm font-orbitron mb-6 tracking-widest flex items-center gap-3 uppercase font-bold">
           Agent Consensus Summary
        </h3>

        <div className="flex flex-col md:flex-row gap-8">
           <div className="flex-grow space-y-4">
              <div className="p-4 rounded-xl bg-black/40 border border-white/5 relative overflow-hidden group">
                 <div className={`absolute top-0 left-0 w-1 h-full ${isFake ? 'bg-neonRed' : 'bg-neonGreen'}`} />
                 <p className="text-white font-rajdhani text-lg leading-relaxed italic">
                    "{isFake ? "The visual data exhibits synthetic patterns consistent with AI generation. High-frequency noise artifacts and lighting inconsistencies detected." : "The visual data demonstrates natural organic patterns with high fidelity across all forensic layers. No synthetic signatures found."}"
                 </p>
              </div>

              <div className="flex flex-wrap gap-3">
                 {isFake ? (
                   <>
                     <span className="px-3 py-1 rounded-full bg-neonRed/10 border border-neonRed/30 text-[10px] text-neonRed font-mono uppercase tracking-widest">Artifacts Detected</span>
                     <span className="px-3 py-1 rounded-full bg-neonRed/10 border border-neonRed/30 text-[10px] text-neonRed font-mono uppercase tracking-widest">Neural Noise</span>
                     <span className="px-3 py-1 rounded-full bg-neonRed/10 border border-neonRed/30 text-[10px] text-neonRed font-mono uppercase tracking-widest">Metadata Missing</span>
                   </>
                 ) : (
                   <>
                     <span className="px-3 py-1 rounded-full bg-neonGreen/10 border border-neonGreen/30 text-[10px] text-neonGreen font-mono uppercase tracking-widest">Natural Grain</span>
                     <span className="px-3 py-1 rounded-full bg-neonGreen/10 border border-neonGreen/30 text-[10px] text-neonGreen font-mono uppercase tracking-widest">Consistent Lighting</span>
                     <span className="px-3 py-1 rounded-full bg-neonGreen/10 border border-neonGreen/30 text-[10px] text-neonGreen font-mono uppercase tracking-widest">Verified Source</span>
                   </>
                 )}
              </div>
           </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ResultsDashboard;
