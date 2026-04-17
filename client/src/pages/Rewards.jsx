import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Trophy, Star, Award, TrendingUp, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

const Rewards = () => {
    const { user } = useAuth();

    const milestones = [
        { name: "Active Citizen", req: 50, icon: <ShieldCheck size={20}/>, color: "bg-blue-50 text-brand-blue" },
        { name: "Silver Contributor", req: 200, icon: <Star size={20}/>, color: "bg-orange-50 text-brand-orange" },
        { name: "Gold Merit", req: 1000, icon: <Award size={20}/>, color: "bg-yellow-50 text-yellow-600" },
    ];

    return (
        <div className="min-h-screen pt-40 pb-20 bg-slate-50">
            <div className="container mx-auto px-6">
                <header className="max-w-3xl mb-16">
                    <div className="flex items-center gap-2 text-brand-orange font-black uppercase text-xs tracking-[0.2em] mb-4">
                        <Trophy size={14} /> Global Loyalty Program
                    </div>
                    <h1 className="text-5xl font-black text-slate-900 tracking-tighter mb-8">Civic <span className="text-brand-orange italic">Rewards.</span></h1>
                    <p className="text-slate-500 font-medium">As a token of appreciation for your vigilance, JanSetu awards points for every valid report submitted. These points represent your impact on our city.</p>
                </header>

                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Points Balance Card */}
                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="card-premium p-10 bg-brand-orange relative overflow-hidden flex flex-col items-center justify-center text-center">
                        <div className="absolute top-0 left-0 w-full h-full bg-white opacity-5 mix-blend-overlay"></div>
                        <p className="text-white/80 font-black uppercase tracking-[0.2em] text-xs mb-4">Available Balance</p>
                        <h2 className="text-8xl font-black text-white mb-2">{user.rewardPoints}</h2>
                        <p className="text-white font-bold opacity-80 uppercase tracking-widest text-sm">JanSetu Points</p>
                    </motion.div>

                    {/* Milestone List */}
                    <div className="lg:col-span-2 space-y-4">
                         {milestones.map((m, i) => (
                             <div key={i} className="card-premium p-8 flex items-center justify-between group">
                                <div className="flex items-center gap-6">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${m.color} shadow-sm group-hover:scale-110 transition-transform`}>
                                        {m.icon}
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-bold text-slate-800">{m.name}</h4>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Requires {m.req} Points</p>
                                    </div>
                                </div>
                                <div className={`p-2 rounded-full border-4 border-slate-100 ${user.rewardPoints >= m.req ? 'bg-green-500 border-green-50' : 'bg-slate-200 opacity-20'}`}>
                                    <ShieldCheck size={20} className="text-white" />
                                </div>
                             </div>
                         ))}
                    </div>
                </div>

                <div className="mt-20 card-premium p-12 bg-white text-center">
                    <TrendingUp className="mx-auto text-brand-blue mb-8" size={48} />
                    <h3 className="text-2xl font-black text-slate-900 mb-4">How to earn more?</h3>
                    <p className="text-slate-500 font-medium max-w-lg mx-auto mb-10 leading-relaxed">Submit reports with high-quality descriptions and clear photos. Once an issue is resolved, your contribution score increases.</p>
                    <button className="btn-blue">Raise an Issue Now</button>
                </div>
            </div>
        </div>
    );
};

export default Rewards;
