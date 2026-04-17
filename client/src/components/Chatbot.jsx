import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { MessageCircle, X, Send, Bot, User, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

const Chatbot = () => {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [chat, setChat] = useState([
        { role: 'bot', text: 'Namaste! I am your JanSetu Assistant. How can I help you improve our city today?' }
    ]);
    const [isTyping, setIsTyping] = useState(false);
    const scrollRef = useRef(null);

    const startListening = () => {
        const recognition = new window.webkitSpeechRecognition();
        recognition.lang = "en-IN";

        recognition.onresult = (event) => {
            const text = event.results[0][0].transcript;
            setMessage(text);
        };

        recognition.start();
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
        setMessage('');
        setIsTyping(true);

        try {
            const config = user?.token ? { headers: { Authorization: `Bearer ${user.token}` } } : {};
            const { data } = await axios.post(
                'http://localhost:5000/api/chat',
                { message },
                config
            );
            setChat(prev => [...prev, { role: 'bot', text: data.reply }]);
        } catch (err) {
            setChat(prev => [...prev, { role: 'bot', text: "I'm currently in lightweight mode. Ask me about rewards or reporting!" }]);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <div className="fixed bottom-1 right-8 z-[1000] flex flex-col items-end">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20, transformOrigin: 'bottom right' }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="mb-2 w-[400px] h-[600px] bg-white rounded-[40px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden flex flex-col border border-slate-100"
                    >
                        {/* Header */}
                        <div className="p-8 bg-slate-900 text-white flex justify-between items-center relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-blue/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                            <div className="flex items-center gap-4 relative z-10">
                                <div className="w-12 h-12 bg-brand-blue rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/40">
                                    <Sparkles size={24} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="font-black text-lg tracking-tighter italic">Jan<span className="text-brand-orange">Setu</span> AI</h3>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Live Terminal</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-hide bg-slate-50/30">
                            {chat.map((msg, i) => (
                                <motion.div
                                    initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    key={i}
                                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div className={`max-w-[85%] p-5 rounded-[24px] shadow-sm ${msg.role === 'user' ? 'bg-brand-blue text-white rounded-tr-none shadow-blue-500/10' : 'bg-white text-slate-700 rounded-tl-none border border-slate-100'}`}>
                                        <p className="text-sm font-bold leading-relaxed">{msg.text}</p>
                                    </div>
                                </motion.div>
                            ))}
                            {isTyping && (
                                <div className="flex justify-start">
                                    <div className="bg-white border border-slate-100 p-4 rounded-2xl rounded-tl-none">
                                        <div className="flex gap-1.5">
                                            <div className="w-1.5 h-1.5 bg-brand-blue rounded-full animate-bounce"></div>
                                            <div className="w-1.5 h-1.5 bg-brand-blue rounded-full animate-bounce [animation-delay:0.2s]"></div>
                                            <div className="w-1.5 h-1.5 bg-brand-blue rounded-full animate-bounce [animation-delay:0.4s]"></div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Input Area */}
                        <form onSubmit={handleSend} className="p-6 bg-white border-t border-slate-100">
                            <div className="relative">

                                {/* 🎤 MIC BUTTON (LEFT) */}
                                <button
                                    type="button"
                                    onClick={startListening}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 bg-gray-200 hover:bg-gray-300 rounded-full p-2 transition"
                                >
                                    🎤
                                </button>

                                {/* 📝 INPUT FIELD */}
                                <input
                                    type="text"
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="Ask about rewards, reports or status..."
                                    className="w-full py-4 pl-12 pr-14 bg-slate-50 rounded-[24px] text-sm font-bold border-2 border-transparent focus:border-brand-blue focus:bg-white focus:outline-none transition-all placeholder:text-slate-300"
                                />

                                {/* 📤 SEND BUTTON (RIGHT) */}
                                <button
                                    type="submit"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-brand-blue text-white rounded-full p-3 hover:bg-black transition shadow-lg shadow-blue-500/20 active:scale-95"
                                >
                                    <Send size={18} />
                                </button>

                            </div>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Persistent Toggle Button */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(!isOpen)}
                className={`w-20 h-20 rounded-full flex items-center justify-center shadow-[0_15px_40px_rgba(0,0,0,0.2)] transition-all duration-500 group ${isOpen ? 'bg-white text-slate-900 border border-slate-100' : 'bg-brand-blue text-white'}`}
            >
                <AnimatePresence mode="wait">
                    {isOpen ? (
                        <motion.div
                            key="close"
                            initial={{ rotate: -90, opacity: 0 }}
                            animate={{ rotate: 0, opacity: 1 }}
                            exit={{ rotate: 90, opacity: 0 }}
                        >
                            <X size={32} strokeWidth={2.5} />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="open"
                            initial={{ rotate: 90, opacity: 0 }}
                            animate={{ rotate: 0, opacity: 1 }}
                            exit={{ rotate: -90, opacity: 0 }}
                        >
                            <MessageCircle size={32} strokeWidth={2.5} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.button>
        </div>
    );
};

export default Chatbot;
