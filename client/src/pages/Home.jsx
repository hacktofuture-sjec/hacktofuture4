import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Trophy, ArrowRight, ShieldCheck, MapPin, Target } from 'lucide-react';
import { motion } from 'framer-motion';

const Home = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    if (!user) return null;

    return (
        <div className="min-h-screen pt-32 pb-20 bg-white">
            <div className="container mx-auto px-6">
                <header className="max-w-4xl mb-20">
                    <h1 className="text-6xl font-black text-slate-900 tracking-tighter mb-8 leading-tight">
                        Namaste, <span className="text-brand-blue">{user.name.split(' ')[0]}</span>. <br />
                        Welcome to <span className="text-brand-orange">JanSetu</span>.
                    </h1>
                    <p className="text-xl text-slate-500 font-medium max-w-2xl leading-relaxed">
                        Your central portal for city administration. Raise your voice, contribute to the community, and track the impact you make.
                    </p>
                </header>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
                    {/* Action Cards */}
                    <motion.div 
                        whileHover={{ y: -10 }}
                        className="card-premium p-10 bg-brand-blue group cursor-pointer"
                        onClick={() => navigate('/report')}
                    >
                        <ShieldCheck className="text-white mb-8" size={40} />
                        <h3 className="text-2xl font-black text-white mb-4">Report an Issue</h3>
                        <p className="text-blue-100 font-medium mb-10">Use AI-powered analysis to report civic issues in seconds.</p>
                        <div className="flex items-center gap-2 text-white font-bold text-sm uppercase tracking-widest group-hover:gap-4 transition-all">
                            Initialize Protocol <ArrowRight size={18} />
                        </div>
                    </motion.div>

                    <motion.div 
                        whileHover={{ y: -10 }}
                        className="card-premium p-10 bg-white border-slate-100 group cursor-pointer"
                        onClick={() => navigate('/dashboard')}
                    >
                        <Target className="text-brand-orange mb-8" size={40} />
                        <h3 className="text-2xl font-black text-slate-900 mb-4">Live Dashboard</h3>
                        <p className="text-slate-500 font-medium mb-10">Track the real-time status of your reports and city responses.</p>
                        <div className="flex items-center gap-2 text-brand-orange font-bold text-sm uppercase tracking-widest group-hover:gap-4 transition-all">
                            View Activity <ArrowRight size={18} />
                        </div>
                    </motion.div>

                    <motion.div 
                        whileHover={{ y: -10 }}
                        className="card-premium p-10 bg-slate-50 border-none group cursor-pointer"
                        onClick={() => navigate('/rewards')}
                    >
                        <Trophy className="text-brand-blue mb-8" size={40} />
                        <h3 className="text-2xl font-black text-slate-800 mb-4">Civic Rewards</h3>
                        <p className="text-slate-500 font-medium mb-10">Every contribution builds your civic score and earns rewards.</p>
                        <div className="inline-flex items-center px-4 py-2 bg-white rounded-xl text-brand-blue font-black text-xs">
                             {user.rewardPoints} JanSetu Points
                        </div>
                    </motion.div>
                </div>

                <div className="card-premium p-12 bg-slate-900 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-orange opacity-10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-12">
                         <div className="max-w-lg">
                            <h2 className="text-3xl font-black text-white mb-4 italic uppercase tracking-tighter">Automated Analysis</h2>
                            <p className="text-slate-400 font-medium leading-relaxed">
                                Our backend uses the Groq AI Matrix to instantly categorize and prioritize your report, ensuring no manual delay in city-to-citizen handshakes.
                            </p>
                         </div>
                         <button onClick={() => navigate('/report')} className="btn-orange whitespace-nowrap">Raise a New Issue</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Home;
