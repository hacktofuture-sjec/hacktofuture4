import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
    ShieldCheck, 
    ArrowRight, 
    Building2, 
    Target, 
    Zap, 
    TrendingUp,
    LayoutDashboard,
    AlertCircle
} from 'lucide-react';
import { motion } from 'framer-motion';

const AuthorityHome = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    if (!user) return null;

    return (
        <div className="min-h-screen pt-32 pb-20 bg-white text-slate-900 overflow-hidden relative">
            {/* Background Accents */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-blue opacity-5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-brand-orange opacity-5 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/2"></div>

            <div className="container mx-auto px-6 relative z-10">
                <header className="max-w-4xl mb-20">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-brand-blue/20 text-brand-blue rounded-full text-xs font-black uppercase tracking-widest mb-8 border border-brand-blue/30">
                        <ShieldCheck size={14} /> Official Authority Access
                    </div>
                    <h1 className="text-6xl lg:text-8xl font-black tracking-tighter mb-8 leading-tight text-slate-900">
                        Command <br /> <span className="text-brand-orange">Terminal.</span>
                    </h1>
                    <p className="text-xl text-slate-500 font-medium max-w-2xl leading-relaxed">
                        Welcome, Officer <span className="text-brand-blue font-bold">{user.name.split(' ')[0]}</span>. You are currently presiding over the <span className="text-brand-blue">{user.department}</span> division. System synchronization is live.
                    </p>
                </header>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
                    {/* Primary Operations */}
                    <motion.div 
                        whileHover={{ y: -10 }}
                        className="p-10 bg-slate-50 border border-slate-100 group cursor-pointer rounded-[40px] shadow-xl hover:shadow-2xl transition-all"
                        onClick={() => navigate('/department')}
                    >
                        <LayoutDashboard className="text-brand-blue mb-8" size={40} />
                        <h3 className="text-2xl font-black text-slate-900 mb-4">Operations Hub</h3>
                        <p className="text-slate-500 font-medium mb-10">Access real-time reports, assign tasks, and update resolution protocols.</p>
                        <div className="flex items-center gap-2 text-brand-blue font-bold text-sm uppercase tracking-widest group-hover:gap-4 transition-all">
                            Initialize Hub <ArrowRight size={18} />
                        </div>
                    </motion.div>

                    <motion.div 
                        whileHover={{ y: -10 }}
                        className="p-10 bg-brand-orange group cursor-pointer rounded-[40px] shadow-2xl transition-all"
                        onClick={() => navigate('/department')}
                    >
                        <AlertCircle className="text-white mb-8" size={40} />
                        <h3 className="text-2xl font-black text-white mb-4">Priority Queue</h3>
                        <p className="text-orange-100 font-medium mb-10">Instant access to high-severity incidents requiring immediate deployment.</p>
                        <div className="flex items-center gap-2 text-white font-bold text-sm uppercase tracking-widest group-hover:gap-4 transition-all">
                            View Alerts <ArrowRight size={18} />
                        </div>
                    </motion.div>

                    <motion.div 
                        whileHover={{ y: -10 }}
                        className="p-10 bg-slate-900 group cursor-pointer rounded-[40px] shadow-2xl transition-all"
                        onClick={() => navigate('/department')}
                    >
                        <TrendingUp className="text-brand-blue mb-8" size={40} />
                        <h3 className="text-2xl font-black text-white mb-4">City Trends</h3>
                        <p className="text-slate-400 font-medium mb-10">Review departmental performance analytics and civic satisfaction trends.</p>
                        <div className="flex items-center gap-2 text-brand-blue font-bold text-sm uppercase tracking-widest group-hover:gap-4 transition-all">
                            Open Console <ArrowRight size={18} />
                        </div>
                    </motion.div>
                </div>

                <div className="p-12 bg-slate-50 border border-slate-100 rounded-[50px]">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-12">
                         <div className="max-w-lg text-center md:text-left">
                            <h2 className="text-3xl font-black text-slate-900 mb-4 italic uppercase tracking-tighter">Department Protocols</h2>
                            <p className="text-slate-500 font-medium leading-relaxed italic">
                                "Efficiency in governance is the bridge between citizen voice and city action."
                            </p>
                         </div>
                         <div className="flex gap-4">
                            <div className="px-8 py-4 bg-white rounded-2xl border border-slate-100 text-center min-w-[120px] shadow-sm">
                                <p className="text-[10px] font-black text-brand-blue uppercase tracking-widest mb-1">Status</p>
                                <p className="text-xl font-black text-slate-900">Active</p>
                            </div>
                            <div className="px-8 py-4 bg-brand-blue rounded-2xl text-center min-w-[120px]">
                                <p className="text-[10px] font-black text-blue-100 uppercase tracking-widest mb-1">Division</p>
                                <p className="text-xl font-black text-white">{user.department.split(' ')[0]}</p>
                            </div>
                         </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthorityHome;
