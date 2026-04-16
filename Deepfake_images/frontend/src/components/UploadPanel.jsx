import React, { useRef } from 'react';
import { Upload, X, Crosshair, Zap, Cpu, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CyberLoader from './CyberLoader';

const UploadPanel = ({ preview, onFileSelect, onAnalyze, analyzing }) => {
  const fileInputRef = useRef();

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="glass-panel-interactive p-8 flex flex-col h-full rounded-2xl relative overflow-hidden group">
      
      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-neonCyan opacity-50"></div>
      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-neonPurple opacity-50"></div>

      <div className="flex items-center justify-between mb-8 relative z-10">
        <h2 className="text-2xl font-bold font-orbitron tracking-widest text-neonCyan flex items-center gap-3">
          <Crosshair className="w-6 h-6 animate-pulse" /> TARGET ACQUISITION
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-neonCyan/40 uppercase">System Status:</span>
          <div className="w-2 h-2 bg-neonCyan rounded-full animate-ping shadow-[0_0_10px_#00f5ff]"></div>
        </div>
      </div>

      <div 
        className={`flex-grow border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-6 text-center transition-all duration-300 relative overflow-hidden group-hover:shadow-[0_0_20px_rgba(0,245,255,0.1)] ${
          preview ? 'border-neonCyan/40 bg-neonCyan/5' : 'border-neonCyan/20 hover:border-neonCyan/60 hover:bg-neonCyan/5'
        }`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => !preview && !analyzing && fileInputRef.current?.click()}
      >
        <AnimatePresence mode="wait">
          {preview ? (
             <motion.div
               key="preview"
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.95 }}
               className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden rounded-lg group"
             >
               <img 
                 src={preview} 
                 alt="Upload Preview" 
                 className={`w-full h-full object-contain p-2 transition-transform duration-700 ${analyzing ? 'scale-105 filter blur-[2px]' : 'scale-100'}`}
               />
               
               {analyzing && (
                 <div className="absolute inset-0 flex items-center justify-center z-30">
                    <div className="bg-cyberDark/60 aspect-square w-64 rounded-full border-2 border-neonCyan/30 flex flex-col items-center justify-center shadow-[0_0_40px_rgba(0,245,255,0.2)] relative overflow-hidden">
                       <div className="absolute inset-0 scale-75">
                          <CyberLoader />
                       </div>
                       <div className="absolute bottom-10 flex flex-col items-center">
                          <div className="w-1.5 h-1.5 bg-neonCyan rounded-full animate-ping"></div>
                       </div>
                    </div>
                 </div>
               )}

               {!analyzing && (
                 <button 
                   onClick={(e) => { e.stopPropagation(); onFileSelect(null); }}
                   className="absolute top-4 right-4 bg-neonRed/20 hover:bg-neonRed text-white p-2 rounded-full transition-all hover:scale-110 shadow-[0_0_15px_rgba(255,23,68,0.2)] z-40 border border-neonRed/50"
                 >
                   <X className="w-5 h-5" />
                 </button>
               )}
             </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="cursor-pointer flex flex-col items-center"
            >
              <div className="w-20 h-20 bg-cyberDark/50 border border-neonCyan/30 rounded-full flex items-center justify-center mb-6 group-hover:border-neonCyan transition-all duration-300 relative">
                 <div className="absolute inset-0 bg-neonCyan/10 rounded-full group-hover:animate-ping"></div>
                 <Upload className="w-8 h-8 text-neonCyan drop-shadow-[0_0_5px_#00f5ff]" />
              </div>
              <p className="text-white font-bold font-orbitron text-lg tracking-widest mb-2 group-hover:text-neonCyan transition-colors">INITIATE UPLOAD</p>
              <p className="text-white/40 font-mono text-[10px] uppercase tracking-[0.3em]">Drag & Drop Evidence Data</p>
            </motion.div>
          )}
        </AnimatePresence>
        <input 
          type="file" 
          ref={fileInputRef}
          onChange={(e) => e.target.files?.[0] && onFileSelect(e.target.files[0])}
          className="hidden" 
          accept="image/*"
        />
      </div>

      <div className="mt-8 relative z-10">
        <button 
          onClick={onAnalyze}
          disabled={!preview || analyzing}
          className={`w-full py-4 font-orbitron font-bold tracking-[0.3em] uppercase transition-all duration-500 rounded-lg flex items-center justify-center gap-3 group relative overflow-hidden ${
            preview && !analyzing 
            ? 'bg-neonCyan/10 text-neonCyan border border-neonCyan shadow-[0_0_15px_rgba(0,245,255,0.2)] hover:shadow-[0_0_30px_rgba(0,245,255,0.4)] hover:bg-neonCyan hover:text-black' 
            : 'bg-white/5 text-white/20 border border-white/5 cursor-not-allowed'
          }`}
        >
          {analyzing ? (
            <>
              <Activity className="w-5 h-5 animate-spin" /> RUNNING HEURISTICS...
            </>
          ) : (
            <>
              <Zap className={`w-5 h-5 ${preview ? 'animate-pulse' : ''}`} /> EXECUTE ANALYSIS
            </>
          )}
          {preview && !analyzing && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite]" />
          )}
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between px-2">
         <div className="flex items-center gap-2">
            <Cpu className="w-3 h-3 text-white/20" />
            <span className="text-[9px] font-mono text-white/20 uppercase tracking-tighter">AI AGENT: ACTIVE</span>
         </div>
         <span className="text-[9px] font-mono text-white/20 uppercase tracking-tighter">DATA LINK: SECURE</span>
      </div>
    </div>
  );
};

export default UploadPanel;
