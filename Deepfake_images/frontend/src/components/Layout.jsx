import React from 'react';
import CyberBackground from './CyberBackground';

const Layout = ({ children }) => {
  return (
    <div className="min-h-screen relative flex flex-col text-slate-200">
      <CyberBackground />
      
      {/* Main Content */}
      <main className="relative z-10 flex-grow px-4 sm:px-6 lg:px-8 pt-10 pb-20">
        {children}
      </main>

      {/* Cyberpunk Footer */}
      <footer className="relative z-10 py-6 border-t border-white/5 bg-black/40 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between px-6">
          <p className="text-neonCyan/50 font-mono text-xs tracking-[0.3em] uppercase">
            DEEPTRUST v3.0.0 // AI ARCHITECTURE
          </p>
          <div className="flex items-center gap-4 mt-4 md:mt-0 font-orbitron text-xs text-white/30 tracking-widest">
            <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-neonCyan animate-pulse-fast"></span> CORE ONLINE</span>
            <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-neonPurple animate-pulse"></span> GROQ LINKED</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
