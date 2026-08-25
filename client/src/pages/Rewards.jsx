import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Trophy, Star, Award, TrendingUp, ShieldCheck, PlusCircle } from 'lucide-react';
import { motion } from 'framer-motion';

const Rewards = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const milestones = [
        { name: "Active Citizen", req: 50, icon: <ShieldCheck size={20}/>, color: "bg-blue-50 text-brand-blue" },
        { name: "Silver Contributor", req: 200, icon: <Star size={20}/>, color: "bg-orange-50 text-brand-orange" },
        { name: "Gold Merit Guardian", req: 1000, icon: <Award size={20}/>, color: "bg-yellow-50 text-yellow-600" },
    ];

    return (
        <div className="min-h-screen pt-20 sm:pt-28 pb-28 sm:pb-20 bg-slate-50">
            <div className="container mx-auto px-4 sm:px-6">
                <header className="max-w-3xl mb-8 sm:mb-12">
                    <div className="flex items-center gap-1.5 text-brand-orange font-black uppercase text-[10px] sm:text-xs tracking-wider mb-2 sm:mb-3">
                        <Trophy size={14} /> Global Civic Loyalty Matrix
                    </div>
                    <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight mb-2 sm:mb-4">
                        Civic <span className="text-brand-orange">Rewards.</span>
                    </h1>
                    <p className="text-slate-500 font-medium text-xs sm:text-base leading-relaxed">
                        JanSetu awards points for valid grievance submissions with photo evidence. Redeemable for civic honors, community recognitions, and public service tokens.
                    </p>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
                    {/* Points Balance Card */}
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }} 
                        animate={{ opacity: 1, scale: 1 }} 
                        className="card-premium p-6 sm:p-10 bg-gradient-to-br from-amber-500 to-orange-600 relative overflow-hidden flex flex-col items-center justify-center text-center rounded-3xl shadow-xl shadow-orange-500/15"
                    >
                        <div className="absolute top-0 left-0 w-full h-full bg-white opacity-5 mix-blend-overlay pointer-events-none"></div>
                        <p className="text-white/80 font-black uppercase tracking-wider text-[10px] sm:text-xs mb-2">Available Balance</p>
                        <h2 className="text-5xl sm:text-7xl lg:text-8xl font-black text-white mb-1 tracking-tight">
                            {user?.rewardPoints || 0}
                        </h2>
                        <p className="text-white font-bold opacity-90 uppercase tracking-widest text-xs sm:text-sm">JanPoints</p>
                    </motion.div>

                    {/* Milestone List */}
                    <div className="lg:col-span-2 space-y-3 sm:space-y-4">
                        {milestones.map((m, i) => {
                            const isAchieved = (user?.rewardPoints || 0) >= m.req;
                            return (
                                <div key={i} className="card-premium p-4 sm:p-6 flex items-center justify-between group bg-white border border-slate-100 rounded-2xl sm:rounded-3xl shadow-xs hover:shadow-md transition-all">
                                    <div className="flex items-center gap-3.5 sm:gap-5">
                                        <div className={`w-11 h-11 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center ${m.color} shadow-xs group-hover:scale-105 transition-transform flex-shrink-0`}>
                                            {m.icon}
                                        </div>
                                        <div>
                                            <h4 className="text-sm sm:text-base font-bold text-slate-800">{m.name}</h4>
                                            <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mt-0.5">Requires {m.req} Points</p>
                                        </div>
                                    </div>
                                    <div className={`p-1.5 sm:p-2 rounded-full border-2 sm:border-4 border-slate-100 flex-shrink-0 ${isAchieved ? 'bg-emerald-500 border-emerald-100 text-white' : 'bg-slate-200 text-slate-400 opacity-40'}`}>
                                        <ShieldCheck size={16} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* How to Earn Card */}
                <div className="mt-8 sm:mt-12 card-premium p-6 sm:p-10 bg-white border border-slate-100 text-center rounded-3xl shadow-sm">
                    <TrendingUp className="mx-auto text-brand-blue mb-4" size={36} />
                    <h3 className="text-lg sm:text-2xl font-black text-slate-900 mb-2">How to earn more JanPoints?</h3>
                    <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-lg mx-auto mb-6 leading-relaxed">
                        Submit reports with precise auto-detected GPS locations and clear photo evidence. Once an issue is resolved by field officers, your civic impact score multiplies!
                    </p>
                    <button 
                        onClick={() => navigate('/report')}
                        className="px-6 py-3.5 bg-brand-blue hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-blue-500/20 active:scale-95 transition-all inline-flex items-center gap-2"
                    >
                        <PlusCircle size={16} /> Report a Problem Now
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Rewards;
