import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, Sparkles, CheckCircle2, AlertTriangle, ShieldCheck, MapPin, Building2, Clock, Radio, PhoneForwarded } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function VoiceCallModal({ isOpen, onClose }) {
  const [callMode, setCallMode] = useState('BROWSER'); // 'BROWSER' | 'PHONE'
  const [callStatus, setCallStatus] = useState('IDLE'); // 'IDLE' | 'CONNECTING' | 'LISTENING' | 'THINKING' | 'SPEAKING' | 'COMPLETED'
  const [phoneNumberInput, setPhoneNumberInput] = useState('+91');
  const [isCallingPhone, setIsCallingPhone] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [currentSpeech, setCurrentSpeech] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [registeredComplaint, setRegisteredComplaint] = useState(null);
  const [manualText, setManualText] = useState('');
  const [callDuration, setCallDuration] = useState(0);

  const recognitionRef = useRef(null);
  const timerRef = useRef(null);
  const synthRef = useRef(typeof window !== 'undefined' ? window.speechSynthesis : null);
  const scrollRef = useRef(null);

  // Initialize session ID when opened
  useEffect(() => {
    if (isOpen) {
      const newSession = `web_call_${Date.now()}`;
      setSessionId(newSession);
      setTranscript([]);
      setCurrentSpeech('');
      setRegisteredComplaint(null);
      setCallDuration(0);
      if (callMode === 'BROWSER') {
        startCall(newSession);
      }
    } else {
      endCall();
    }
  }, [isOpen]);

  // Scroll transcript to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript, currentSpeech]);

  // Duration Timer
  useEffect(() => {
    if (callStatus !== 'IDLE' && callStatus !== 'COMPLETED') {
      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [callStatus]);

  // Format Duration seconds
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Text-To-Speech Output
  const speakVoice = (text, callback) => {
    if (isSpeakerMuted || !synthRef.current) {
      if (callback) callback();
      return;
    }
    synthRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const voices = synthRef.current.getVoices();
    const preferredVoice = voices.find(v => v.lang.includes('en-IN') || v.name.includes('Google') || v.name.includes('Natural')) || voices[0];
    if (preferredVoice) utterance.voice = preferredVoice;

    setCallStatus('SPEAKING');

    utterance.onend = () => {
      if (callback) callback();
    };
    utterance.onerror = () => {
      if (callback) callback();
    };

    synthRef.current.speak(utterance);
  };

  // Start Speech Recognition
  const initSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Voice recognition not supported in this browser. You can type below.');
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-IN';

    recognition.onstart = () => {
      setCallStatus('LISTENING');
    };

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setCurrentSpeech(interim || final);

      if (final.trim().length > 0) {
        handleUserSpokenMessage(final.trim());
      }
    };

    recognition.onerror = (event) => {
      console.warn('Speech Recognition Event:', event.error);
      if (event.error === 'not-allowed') {
        toast.error('Microphone permission denied.');
      }
    };

    recognition.onend = () => {
      if (callStatus === 'LISTENING' && !isMuted) {
        try {
          recognition.start();
        } catch (e) {}
      }
    };

    return recognition;
  };

  // Start Call Flow
  const startCall = (activeSession) => {
    setCallStatus('CONNECTING');
    
    const greetingText = "Namaste! Welcome to JanSetu Smart City Grievance Helpline. Please describe the civic issue you want to report, along with your location or landmark.";
    
    setTimeout(() => {
      setTranscript([{ role: 'agent', text: greetingText, time: new Date().toLocaleTimeString() }]);
      speakVoice(greetingText, () => {
        listenForUser();
      });
    }, 600);
  };

  // Listen for user speech
  const listenForUser = () => {
    if (isMuted) return;
    try {
      if (recognitionRef.current) recognitionRef.current.stop();
      recognitionRef.current = initSpeechRecognition();
      if (recognitionRef.current) {
        recognitionRef.current.start();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Send speech turn to backend AI
  const handleUserSpokenMessage = async (userText) => {
    if (!userText.trim()) return;

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }

    setTranscript(prev => [...prev, { role: 'user', text: userText, time: new Date().toLocaleTimeString() }]);
    setCurrentSpeech('');
    setCallStatus('THINKING');

    try {
      const response = await axios.post('http://localhost:5000/api/voice/web-agent', {
        message: userText,
        sessionId: sessionId,
        callerPhone: '+919876543210'
      });

      const { spokenReply, isFinished, complaint } = response.data;

      setTranscript(prev => [...prev, { role: 'agent', text: spokenReply, time: new Date().toLocaleTimeString() }]);

      if (isFinished && complaint) {
        setRegisteredComplaint(complaint);
        speakVoice(spokenReply, () => {
          setCallStatus('COMPLETED');
          toast.success(`Complaint #${complaint._id.toString().slice(-6)} Registered!`);
        });
      } else {
        speakVoice(spokenReply, () => {
          listenForUser();
        });
      }
    } catch (err) {
      console.error('Call processing failed:', err);
      const errReply = "I could not connect to the city servers. Please try stating the issue again.";
      setTranscript(prev => [...prev, { role: 'agent', text: errReply, time: new Date().toLocaleTimeString() }]);
      speakVoice(errReply, () => {
        listenForUser();
      });
    }
  };

  // Trigger Outbound AI Call to user phone
  const handleRequestPhoneCall = async (e) => {
    e.preventDefault();
    if (!phoneNumberInput || phoneNumberInput.length < 10) {
      return toast.error('Please enter a valid phone number with country code (e.g. +91...)');
    }

    setIsCallingPhone(true);
    const callToast = toast.loading(`Triggering AI Voice Call to ${phoneNumberInput}...`);

    try {
      const res = await axios.post('http://localhost:5000/api/voice/call-user', {
        phoneNumber: phoneNumberInput
      });

      if (res.data.success) {
        toast.success(`📞 Calling your phone now! Please pick up the call.`, { id: callToast, duration: 6000 });
      } else {
        toast.error(res.data.message || 'Call failed', { id: callToast });
      }
    } catch (err) {
      console.error('Outbound call failed:', err);
      toast.error(err.response?.data?.message || 'Failed to place call. Check Twilio settings.', { id: callToast });
    } finally {
      setIsCallingPhone(false);
    }
  };

  // Handle Manual Fallback Input
  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualText.trim()) return;
    const text = manualText;
    setManualText('');
    handleUserSpokenMessage(text);
  };

  // End Call
  const endCall = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    setCallStatus('IDLE');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ duration: 0.25 }}
          className="relative w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-6 bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-slate-900 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 text-blue-400">
                <Radio className="w-6 h-6 animate-pulse" />
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  JanSetu AI Voice Helpline
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-medium border border-blue-500/30">
                    Live Agent
                  </span>
                </h3>
                <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  Call Duration: <span className="font-mono text-emerald-400 font-semibold">{formatTime(callDuration)}</span>
                </p>
              </div>
            </div>

            {/* Speaker Mute & Close */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsSpeakerMuted(!isSpeakerMuted)}
                className={`p-2.5 rounded-xl border transition ${
                  isSpeakerMuted
                    ? 'bg-red-500/20 border-red-500/40 text-red-400'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
                title={isSpeakerMuted ? "Unmute Voice" : "Mute Voice"}
              >
                {isSpeakerMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <button
                onClick={() => { endCall(); onClose(); }}
                className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 transition"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex bg-slate-950 px-6 py-2.5 border-b border-slate-800 gap-2">
            <button
              onClick={() => {
                setCallMode('BROWSER');
                const newSession = `web_call_${Date.now()}`;
                setSessionId(newSession);
                setTranscript([]);
                startCall(newSession);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition ${
                callMode === 'BROWSER'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-900/60'
              }`}
            >
              <Mic className="w-3.5 h-3.5" /> Talk via Browser (Instant Free)
            </button>
            <button
              onClick={() => {
                endCall();
                setCallMode('PHONE');
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition ${
                callMode === 'PHONE'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-900/60'
              }`}
            >
              <PhoneForwarded className="w-3.5 h-3.5" /> Call My Mobile Phone
            </button>
          </div>

          {callMode === 'PHONE' ? (
            <div className="p-8 space-y-6 bg-slate-900 text-center">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Phone className="w-8 h-8 animate-bounce" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-white mb-1">We Call You Directly</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Enter your mobile phone number below. Our AI helpline officer will immediately place a call to your phone for free!
                </p>
              </div>

              <form onSubmit={handleRequestPhoneCall} className="max-w-sm mx-auto space-y-4">
                <div className="relative">
                  <input
                    type="tel"
                    required
                    value={phoneNumberInput}
                    onChange={(e) => setPhoneNumberInput(e.target.value)}
                    placeholder="+91 9876543210"
                    className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3.5 text-center font-mono text-base font-bold text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isCallingPhone}
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white rounded-2xl text-sm font-bold shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2"
                >
                  <Phone className="w-4 h-4" />
                  {isCallingPhone ? 'Placing Call...' : '📞 Call My Phone Now'}
                </button>
              </form>

              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-left text-xs text-slate-400 space-y-1">
                <p className="font-semibold text-slate-300">💡 Why use this?</p>
                <p>Because you are receiving an incoming call, it requires <strong>zero ISD/recharge balance</strong> on your mobile phone!</p>
              </div>
            </div>
          ) : (
            <>
              {/* Voice Waveform & Status Visualizer */}
              <div className="py-6 px-6 bg-slate-950/60 border-b border-slate-800 flex flex-col items-center justify-center">
                {/* Status Pill */}
                <div className="mb-4">
                  {callStatus === 'CONNECTING' && (
                    <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-semibold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                      Connecting to AI Officer...
                    </span>
                  )}
                  {callStatus === 'LISTENING' && (
                    <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      Listening... Speak clearly
                    </span>
                  )}
                  {callStatus === 'THINKING' && (
                    <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-semibold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 animate-spin text-purple-400" />
                      Groq AI Triaging...
                    </span>
                  )}
                  {callStatus === 'SPEAKING' && (
                    <span className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold flex items-center gap-1.5">
                      <Volume2 className="w-3.5 h-3.5 text-cyan-400 animate-bounce" />
                      AI Officer Speaking...
                    </span>
                  )}
                  {callStatus === 'COMPLETED' && (
                    <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Complaint Registered Successfully
                    </span>
                  )}
                </div>

                {/* Animated Waveform Visualizer */}
                <div className="flex items-center justify-center gap-1.5 h-14">
                  {[...Array(14)].map((_, i) => {
                    const isActive = callStatus === 'LISTENING' || callStatus === 'SPEAKING';
                    return (
                      <motion.div
                        key={i}
                        animate={{
                          height: isActive ? [12, Math.max(16, (i % 5) * 10 + 15), 8, 36, 12] : 8,
                          backgroundColor: callStatus === 'LISTENING' ? '#10b981' : callStatus === 'SPEAKING' ? '#06b6d4' : '#64748b'
                        }}
                        transition={{
                          repeat: Infinity,
                          duration: 0.8 + (i % 4) * 0.2,
                          ease: 'easeInOut'
                        }}
                        className="w-1.5 rounded-full"
                      />
                    );
                  })}
                </div>

                {/* Live interim text preview */}
                {currentSpeech && (
                  <p className="mt-3 text-xs text-emerald-300 font-medium italic max-w-md text-center bg-emerald-950/40 px-3 py-1.5 rounded-lg border border-emerald-800/40">
                    "{currentSpeech}..."
                  </p>
                )}
              </div>

              {/* Transcript Area */}
              <div
                ref={scrollRef}
                className="flex-1 p-5 overflow-y-auto space-y-4 max-h-72 min-h-48 bg-slate-900/50"
              >
                {transcript.map((msg, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <span className="text-[10px] text-slate-500 mb-1 px-1">{msg.role === 'user' ? 'You' : 'AI Officer'} • {msg.time}</span>
                    <div
                      className={`max-w-[85%] p-3.5 rounded-2xl text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-blue-600 text-white rounded-tr-sm shadow-md'
                          : 'bg-slate-800 text-slate-200 border border-slate-700/80 rounded-tl-sm shadow-sm'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </motion.div>
                ))}

                {/* Registered Complaint Summary Card */}
                {registeredComplaint && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-4 bg-emerald-950/40 border border-emerald-600/40 rounded-2xl text-slate-200 space-y-2 mt-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4" /> Official Grievance Ticket
                      </span>
                      <span className="font-mono text-xs bg-emerald-500/20 px-2 py-0.5 rounded-md text-emerald-300 font-bold border border-emerald-500/30">
                        #{registeredComplaint._id.toString().slice(-6)}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-white">{registeredComplaint.title}</p>
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 pt-1">
                      <div className="flex items-center gap-1.5 bg-slate-900/60 p-2 rounded-lg">
                        <Building2 className="w-3.5 h-3.5 text-blue-400" />
                        <span>Dept: <strong className="text-blue-300">{registeredComplaint.department}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-slate-900/60 p-2 rounded-lg">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        <span>Priority: <strong className="text-amber-300">{registeredComplaint.priority}</strong></span>
                      </div>
                      <div className="col-span-2 flex items-center gap-1.5 bg-slate-900/60 p-2 rounded-lg">
                        <MapPin className="w-3.5 h-3.5 text-red-400" />
                        <span className="truncate">{registeredComplaint.location}</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Footer Controls */}
              <div className="p-4 bg-slate-950 border-t border-slate-800 space-y-3">
                {/* Fallback Text Input */}
                <form onSubmit={handleManualSubmit} className="flex gap-2">
                  <input
                    type="text"
                    value={manualText}
                    onChange={(e) => setManualText(e.target.value)}
                    placeholder="Or type your response here..."
                    disabled={callStatus === 'COMPLETED'}
                    className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                  />
                  <button
                    type="submit"
                    disabled={!manualText.trim() || callStatus === 'COMPLETED'}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition"
                  >
                    Send
                  </button>
                </form>

                {/* Bottom Action Bar */}
                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={() => {
                      setIsMuted(!isMuted);
                      if (!isMuted && recognitionRef.current) {
                        try { recognitionRef.current.stop(); } catch (e) {}
                      } else {
                        listenForUser();
                      }
                    }}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold transition ${
                      isMuted
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-emerald-400" />}
                    {isMuted ? 'Mic Muted' : 'Mic Live'}
                  </button>

                  {callStatus === 'COMPLETED' ? (
                    <button
                      onClick={() => {
                        const newSession = `web_call_${Date.now()}`;
                        setSessionId(newSession);
                        setTranscript([]);
                        setRegisteredComplaint(null);
                        setCallDuration(0);
                        startCall(newSession);
                      }}
                      className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-lg transition"
                    >
                      <Phone className="w-4 h-4" />
                      Report Another Issue
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        endCall();
                        onClose();
                      }}
                      className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-red-600/30 transition"
                    >
                      <PhoneOff className="w-4 h-4" />
                      End Call
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
