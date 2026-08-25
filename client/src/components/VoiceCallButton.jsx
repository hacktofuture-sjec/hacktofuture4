import React, { useState } from 'react';
import { PhoneCall, Sparkles, Mic } from 'lucide-react';
import { motion } from 'framer-motion';
import VoiceCallModal from './VoiceCallModal';

export default function VoiceCallButton({ isFloating = true }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {isFloating ? (
        <div className="fixed bottom-20 md:bottom-8 left-6 md:left-8 z-[990]">
          <motion.button
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-3 px-5 py-3.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white rounded-full shadow-[0_10px_30px_rgba(16,185,129,0.35)] border border-emerald-400/40 hover:shadow-emerald-500/50 transition-all group cursor-pointer"
          >
            <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-white/20">
              <PhoneCall className="w-4 h-4 animate-bounce text-white" />
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-300 rounded-full animate-ping" />
            </div>
            <div className="text-left">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-100 flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" /> AI Calling Agent
              </div>
              <div className="text-xs font-black">Voice Report Call</div>
            </div>
          </motion.button>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2 bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 hover:bg-emerald-500/20 rounded-xl text-xs font-bold transition-all shadow-sm group cursor-pointer"
        >
          <Mic className="w-3.5 h-3.5 text-emerald-500 group-hover:animate-pulse" />
          <span>Call AI Helpline</span>
        </button>
      )}

      <VoiceCallModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
