import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { MessageCircle, X, Send, Bot, User, Sparkles, Mic, MicOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

const Chatbot = () => {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [chat, setChat] = useState([
        { role: 'bot', text: 'Namaste! I am your JanSetu Assistant. How can I help you improve our city today?' }
    ]);
    const [isTyping, setIsTyping] = useState(false);
    const scrollRef = useRef(null);

    const startListening = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert('Voice input is not supported in this browser.');
            return;
        }

        try {
            const recognition = new SpeechRecognition();
            recognition.lang = "en-IN";
            setIsListening(true);

            recognition.onresult = (event) => {
                const text = event.results[0][0].transcript;
                setMessage(text);
                setIsListening(false);
            };

            recognition.onerror = () => {
                setIsListening(false);
            };

            recognition.onend = () => {
                setIsListening(false);
            };

            recognition.start();
        } catch (err) {
            setIsListening(false);
        }
    };

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [chat, isTyping]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!message.trim()) return;

        const userMsg = { role: 'user', text: message };
        setChat(prev => [...prev, userMsg]);
        const currentMsg = message;
        setMessage('');
        setIsTyping(true);

        try {
            const config = user?.token ? { headers: { Authorization: `Bearer ${user.token}` } } : {};
            const { data } = await axios.post(
                'http://localhost:5000/api/chat',
                { message: currentMsg },
                config
            );
            setChat(prev => [...prev, { role: 'bot', text: data.reply }]);
        } catch (err) {
            setChat(prev => [...prev, { role: 'bot', text: "I'm currently in lightweight mode. Ask me about rewards, GPS reports, or municipal departmental statuses!" }]);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <div className="fixed bottom-16 sm:bottom-6 right-3 sm:right-6 z-[1200] flex flex-col items-end pointer-events-none">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20, transformOrigin: 'bottom right' }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="pointer-events-auto mb-3 w-[calc(100vw-1.5rem)] sm:w-[400px] h-[78vh] sm:h-[580px] max-h-[620px] bg-white rounded-3xl sm:rounded-[36px] shadow-[0_20px_50px_rgba(0,0,0,0.2)] overflow-hidden flex flex-col border border-slate-200"
                    >
                        {/* Header */}
                        <div className="px-5 py-4 sm:p-6 bg-slate-900 text-white flex justify-between items-center relative overflow-hidden flex-shrink-0">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-blue/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                            <div className="flex items-center gap-3 relative z-10">
                                <div className="w-10 h-10 bg-brand-blue rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/40">
                                    <Sparkles size={20} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="font-black text-base sm:text-lg tracking-tight">Jan<span className="text-brand-orange">Setu</span> AI</h3>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Live Civic Assistant</span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="relative z-10 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                                aria-label="Close Assistant"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Messages Area */}
                        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/50">
                            {chat.map((msg, i) => (
                                <motion.div
                                    initial={{ opacity: 0, x: msg.role === 'user' ? 15 : -15 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    key={i}
                                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div className={`max-w-[85%] p-3.5 sm:p-4 rounded-2xl text-xs sm:text-sm font-medium leading-relaxed ${
                                        msg.role === 'user' 
                                            ? 'bg-brand-blue text-white rounded-tr-none shadow-sm shadow-blue-500/20' 
                                            : 'bg-white text-slate-800 rounded-tl-none border border-slate-200/80 shadow-xs'
                                    }`}>
                                        <p>{msg.text}</p>
                                    </div>
                                </motion.div>
                            ))}
                            {isTyping && (
                                <div className="flex justify-start">
                                    <div className="bg-white border border-slate-200/80 p-3 rounded-2xl rounded-tl-none shadow-xs">
                                        <div className="flex gap-1.5">
                                            <div className="w-2 h-2 bg-brand-blue rounded-full animate-bounce"></div>
                                            <div className="w-2 h-2 bg-brand-blue rounded-full animate-bounce [animation-delay:0.2s]"></div>
                                            <div className="w-2 h-2 bg-brand-blue rounded-full animate-bounce [animation-delay:0.4s]"></div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Input Area */}
                        <form onSubmit={handleSend} className="p-3 sm:p-4 bg-white border-t border-slate-100 flex-shrink-0">
                            <div className="relative flex items-center">
                                {/* 🎤 MIC BUTTON */}
                                <button
                                    type="button"
                                    onClick={startListening}
                                    className={`absolute left-2.5 p-2 rounded-xl transition-all ${
                                        isListening 
                                            ? 'bg-red-500 text-white animate-pulse' 
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                    title="Voice Input"
                                >
                                    <Mic size={16} />
                                </button>

                                {/* INPUT FIELD */}
                                <input
                                    type="text"
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="Ask about rewards, reports, status..."
                                    className="w-full py-3 pl-12 pr-12 bg-slate-50 rounded-2xl text-xs sm:text-sm font-medium border border-slate-200 focus:border-brand-blue focus:bg-white focus:outline-none transition-all placeholder:text-slate-400"
                                />

                                {/* SEND BUTTON */}
                                <button
                                    type="submit"
                                    disabled={!message.trim()}
                                    className="absolute right-2 bg-brand-blue disabled:opacity-40 text-white rounded-xl p-2 hover:bg-blue-600 transition shadow-md shadow-blue-500/20 active:scale-95"
                                    aria-label="Send message"
                                >
                                    <Send size={16} />
                                </button>
                            </div>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Persistent Floating Toggle Button */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(!isOpen)}
                className={`pointer-events-auto w-12 h-12 sm:w-16 sm:h-16 rounded-2xl sm:rounded-full flex items-center justify-center shadow-xl transition-all duration-300 ${
                    isOpen 
                        ? 'bg-white text-slate-900 border border-slate-200' 
                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-500/30'
                }`}
                aria-label="Toggle JanSetu AI Assistant"
            >
                <AnimatePresence mode="wait">
                    {isOpen ? (
                        <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
                            <X size={24} strokeWidth={2.5} />
                        </motion.div>
                    ) : (
                        <motion.div key="open" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
                            <MessageCircle size={24} strokeWidth={2.5} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.button>
        </div>
    );
};

export default Chatbot;
