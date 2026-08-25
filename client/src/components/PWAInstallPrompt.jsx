import React, { useState, useEffect } from 'react';
import { Download, X, Wifi, WifiOff, Smartphone, ShieldCheck, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showOfflineAlert, setShowOfflineAlert] = useState(false);

  useEffect(() => {
    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isStandalone) {
      return;
    }

    const handleBeforeInstallPrompt = (e) => {
      // Prevent automatic browser banner
      e.preventDefault();
      setDeferredPrompt(e);
      // Wait a few seconds before showing to not distract user immediately
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
      return () => clearTimeout(timer);
    };

    const handleOnline = () => {
      setIsOffline(false);
      setShowOfflineAlert(true);
      setTimeout(() => setShowOfflineAlert(false), 3000);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setShowOfflineAlert(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // On iOS or manual instructions
      alert("To install JanSetu on your iPhone or iPad: tap the Share button in Safari, then select 'Add to Home Screen'.");
      setShowPrompt(false);
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  return (
    <>
      {/* Offline / Online Status Toast */}
      <AnimatePresence>
        {showOfflineAlert && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-[3000] px-5 py-2.5 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-black uppercase tracking-wider backdrop-blur-md ${
              isOffline
                ? 'bg-amber-500/95 text-white border border-amber-400'
                : 'bg-emerald-600/95 text-white border border-emerald-500'
            }`}
          >
            {isOffline ? (
              <>
                <WifiOff size={16} className="animate-pulse" />
                <span>Offline Mode Enabled • Cached Data Active</span>
              </>
            ) : (
              <>
                <Wifi size={16} />
                <span>Online • Connected to Live JanSetu Matrix</span>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* PWA Install Banner */}
      <AnimatePresence>
        {showPrompt && (
          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 60, scale: 0.95 }}
            className="fixed bottom-20 sm:bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-[1500]"
          >
            <div className="bg-slate-900/95 text-white p-4 sm:p-5 rounded-3xl shadow-2xl border border-slate-700/80 backdrop-blur-xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <img
                  src="/JanSetuLogo.jpeg"
                  alt="JanSetu Icon"
                  className="w-12 h-12 rounded-2xl object-cover border border-slate-700 shadow-md flex-shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-sm font-black tracking-tight text-white truncate">
                      Install JanSetu App
                    </h4>
                    <span className="px-1.5 py-0.5 bg-brand-blue text-[9px] font-black uppercase rounded tracking-wider">
                      PWA
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 truncate">
                    Fast access, offline mode & GPS reporting
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={handleInstallClick}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-500/25 active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <Download size={14} /> Install
                </button>
                <button
                  onClick={() => setShowPrompt(false)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default PWAInstallPrompt;
