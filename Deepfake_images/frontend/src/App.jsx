import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import Layout from './components/Layout';
import HeroSection from './components/HeroSection';
import UploadPanel from './components/UploadPanel';
import ResultsDashboard from './components/ResultsDashboard';
import LLMExplanationPanel from './components/LLMExplanationPanel';
import CyberLoader from './components/CyberLoader';
import { AlertTriangle, RefreshCcw, Volume2, VolumeX, Sun, Moon, Activity } from 'lucide-react';

function App() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  
  // Pipeline State
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  
  const [explaining, setExplaining] = useState(false);
  const [explanation, setExplanation] = useState(null);
  
  const [error, setError] = useState(null);

  // Settings State
  const [isLight, setIsLight] = useState(false);
  const [isSoundOn, setIsSoundOn] = useState(true);

  // Effect to handle theme switching
  useEffect(() => {
    if (isLight) {
      document.body.classList.add('light-cyber');
    } else {
      document.body.classList.remove('light-cyber');
    }
  }, [isLight]);

  const handleFileSelect = (selectedFile) => {
    setError(null);
    setResults(null);
    setExplanation(null);
    
    if (selectedFile) {
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
    } else {
      setFile(null);
      setPreview(null);
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;

    setAnalyzing(true);
    setError(null);
    setResults(null);
    setExplanation(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      // Temporary simulated delay to show fullscreen laser
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Step 1: Core Multi-Agent Analysis
      const analyzeRes = await axios.post('http://localhost:8000/analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const analysisData = analyzeRes.data;
      setResults(analysisData);
      setAnalyzing(false);

      // Step 2: Trigger LLM Reasoning Engine
      setExplaining(true);
      try {
        const explainRes = await axios.post('http://localhost:8000/explain', { results: analysisData }, {
          headers: { 'Content-Type': 'application/json' }
        });
        setExplanation(explainRes.data.llm_explanation);
      } catch (llmErr) {
        console.error("LLM Generation Failed:", llmErr);
        setExplanation(`Error AI Reasoning Engine: ${llmErr.response?.data?.detail || llmErr.message}. The Groq pipeline encountered a synchronization fault.`);
      } finally {
        setExplaining(false);
      }
      
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Neural link severed. Failed to connect to local 8000 port.');
      setAnalyzing(false);
    }
  };

  return (
    <Layout>
       <AnimatePresence>
         {analyzing && (
           <motion.div 
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             exit={{ opacity: 0 }}
             className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md overflow-hidden"
           >
             {/* Full-screen scan beam */}
             <div className="absolute top-0 left-0 w-full h-[3px] bg-neonCyan shadow-[0_0_15px_#00f5ff,0_0_30px_#00f5ff] animate-scan-beam" />
             
             {/* Radial gradient background */}
             <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,245,255,0.1)_0%,transparent_60%)]" />

             {/* Central 3D Core */}
             <div className="relative w-96 h-96">
                <div className="absolute inset-0 scale-[2.0] flex items-center justify-center">
                   <CyberLoader />
                </div>
                <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center whitespace-nowrap">
                   <p className="font-orbitron tracking-[0.3em] text-white font-bold text-sm uppercase text-glow-cyan bg-black/80 px-6 py-3 rounded border border-neonCyan/50 shadow-[0_0_20px_rgba(0,245,255,0.3)] flex items-center gap-3">
                     <Activity className="w-5 h-5 animate-spin text-neonCyan" />
                     NEURAL LINK ACTIVE
                   </p>
                   <div className="flex gap-2 mt-6">
                      {[1,2,3,4,5].map(i => (
                        <div key={i} className="w-1.5 h-4 bg-neonCyan/60 animate-pulse shadow-[0_0_10px_#00f5ff]" style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                   </div>
                </div>
             </div>
           </motion.div>
         )}
       </AnimatePresence>

       <div className={`transition-all duration-700 relative z-10 ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>
          {/* Top Bar Controls */}
          <div className="max-w-6xl mx-auto flex justify-end gap-4 px-4 pt-4 relative z-50">
             <button 
               onClick={() => setIsSoundOn(!isSoundOn)}
               className={`p-2 rounded-lg border transition-all duration-300 ${isSoundOn ? 'border-neonCyan text-neonCyan bg-neonCyan/5 shadow-[0_0_10px_rgba(0,245,255,0.2)]' : 'border-white/10 text-white/30'}`}
               title={isSoundOn ? "Sound On" : "Sound Off"}
             >
               {isSoundOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
             </button>
             <button 
               onClick={() => setIsLight(!isLight)}
               className={`p-2 rounded-lg border transition-all duration-300 ${isLight ? 'border-neonPurple text-neonPurple bg-neonPurple/5 shadow-[0_0_10px_rgba(157,0,255,0.2)]' : 'border-white/10 text-white/30'}`}
               title={isLight ? "Dark Mode" : "Light Mode"}
             >
               {isLight ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
             </button>
          </div>

          <div className="max-w-6xl mx-auto space-y-12 pb-24 relative z-10 pt-4">
            
            <HeroSection />

            {/* Central Command Row */}
            <div className="flex flex-col gap-12 relative z-20">
              
              {/* Top: Input Stream */}
              <motion.div 
                 className="w-full max-w-xl mx-auto"
                 initial={{ y: 50, opacity: 0 }}
                 animate={{ y: 0, opacity: 1 }}
                 transition={{ duration: 0.8 }}
              >
                 <UploadPanel 
                   preview={preview} 
                   onFileSelect={handleFileSelect} 
                   onAnalyze={handleAnalyze} 
                   analyzing={analyzing} 
                 />
              </motion.div>

              {/* Bottom: Datastream / Results */}
              <motion.div 
                 className="w-full flex justify-center min-h-[400px]"
                 initial={{ y: 50, opacity: 0 }}
                 animate={{ y: 0, opacity: 1 }}
                 transition={{ duration: 0.8, delay: 0.2 }}
              >
                 <AnimatePresence mode="wait">
                   {!results && !analyzing && !error && (
                     <motion.div 
                       key="idle"
                       initial={{ opacity: 0, scale: 0.8 }}
                       animate={{ opacity: 1, scale: 1 }}
                       exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
                       className={`w-full max-w-xl glass-panel p-10 h-full flex flex-col items-center justify-center rounded-2xl border border-white/5 opacity-50 relative overflow-hidden ${isLight ? 'bg-white/10' : ''}`}
                     >
                       {/* idle grid decoration */}
                       <div className="absolute inset-0 bg-[linear-gradient(rgba(0,245,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,245,255,0.05)_1px,transparent_1px)] bg-[size:20px_20px]" />
                       <h3 className="font-mono text-white/30 tracking-[0.5em] uppercase relative z-10 text-center flex flex-col gap-4">
                         <span className="w-4 h-4 rounded-full bg-white/10 animate-pulse mx-auto shadow-[0_0_15px_rgba(255,255,255,0.2)]"></span>
                         Awaiting Input Matrix...
                       </h3>
                     </motion.div>
                   )}

                   {error && (
                     <motion.div 
                       key="error"
                       initial={{ opacity: 0, y: 20 }}
                       animate={{ opacity: 1, y: 0 }}
                       exit={{ opacity: 0 }}
                       className="w-full max-w-xl bg-neonRed/10 border-2 border-neonRed rounded-2xl p-6 flex items-start gap-4 shadow-[#ff1744_0px_0px_30px_0px_inset] overflow-hidden relative"
                     >
                       <div className="glitch-layer w-full h-full absolute inset-0 pointer-events-none opacity-20"></div>
                       <AlertTriangle className="text-neonRed w-8 h-8 flex-shrink-0 animate-pulse" />
                       <div>
                         <h3 className="text-neonRed font-orbitron font-bold text-xl mb-2 tracking-widest uppercase">System Fault</h3>
                         <p className="text-white/80 font-mono text-sm">{error}</p>
                       </div>
                     </motion.div>
                   )}

                   {results && (
                     <motion.div key="results" className="w-full space-y-8 flex flex-col pb-10">
                        <ResultsDashboard results={results} />
                        <LLMExplanationPanel explanation={explanation} explaining={explaining} />
                        
                        {!explaining && explanation && (
                          <motion.button 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            onClick={() => handleFileSelect(null)} 
                            className="cyber-button mx-auto mt-8 px-8 py-4 bg-neonCyan/10 hover:bg-neonCyan text-neonCyan hover:text-black border border-neonCyan transition-all duration-300 font-orbitron font-bold tracking-[0.2em] shadow-[0_0_15px_rgba(0,245,255,0.2)] hover:shadow-[0_0_30px_rgba(0,245,255,0.6)] flex items-center gap-3"
                          >
                            <RefreshCcw className="w-5 h-5" /> DISENGAGE & SCAN NEW TARGET
                          </motion.button>
                        )}
                     </motion.div>
                   )}
                 </AnimatePresence>
              </motion.div>

            </div>
          </div>
       </div>
    </Layout>
  );
}

export default App;
