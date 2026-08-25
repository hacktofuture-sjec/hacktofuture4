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
        <div className="min-h-screen pt-20 sm:pt-28 pb-28 sm:pb-20 bg-white text-slate-900 overflow-hidden relative">
            {/* Background Accents */}
            <div className="absolute top-0 right-0 w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-brand-blue opacity-5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-brand-orange opacity-5 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>

            <div className="container mx-auto px-4 sm:px-6 relative z-10">
                <header className="max-w-4xl mb-10 sm:mb-16">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-blue/15 text-brand-blue rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider mb-4 border border-brand-blue/30">
                        <ShieldCheck size={14} /> Official Authority Access
                    </div>
                    <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight mb-4 leading-tight text-slate-900">
                        Command <br className="hidden sm:inline" /> <span className="text-brand-orange">Terminal.</span>
                    </h1>
                    <p className="text-sm sm:text-lg text-slate-500 font-medium max-w-2xl leading-relaxed">
                        Welcome, Officer <span className="text-brand-blue font-bold">{user.name.split(' ')[0]}</span>. You are currently presiding over the <span className="text-brand-blue">{user.department}</span> division.
                    </p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-8 mb-10 sm:mb-16">
                    {/* Primary Operations */}
                    <motion.div 
                        whileHover={{ y: -6 }}
                        className="p-6 sm:p-10 bg-slate-50 border border-slate-100 group cursor-pointer rounded-3xl sm:rounded-[40px] shadow-sm hover:shadow-xl transition-all"
                        onClick={() => navigate('/department')}
                    >
                        <LayoutDashboard className="text-brand-blue mb-6" size={36} />
                        <h3 className="text-xl sm:text-2xl font-black text-slate-900 mb-2">Operations Hub</h3>
                        <p className="text-xs sm:text-sm text-slate-500 font-medium mb-6 leading-relaxed">Access real-time reports, assign tasks, and update resolution protocols.</p>
                        <div className="flex items-center gap-2 text-brand-blue font-bold text-xs sm:text-sm uppercase tracking-wider group-hover:gap-3 transition-all">
                            Initialize Hub <ArrowRight size={16} />
                        </div>
                    </motion.div>

                    <motion.div 
                        whileHover={{ y: -6 }}
                        className="p-6 sm:p-10 bg-gradient-to-br from-amber-500 to-orange-600 group cursor-pointer rounded-3xl sm:rounded-[40px] shadow-lg shadow-orange-500/20 transition-all text-white"
                        onClick={() => navigate('/department')}
                    >
                        <AlertCircle className="text-white mb-6" size={36} />
                        <h3 className="text-xl sm:text-2xl font-black text-white mb-2">Priority Queue</h3>
                        <p className="text-xs sm:text-sm text-orange-100 font-medium mb-6 leading-relaxed">Instant access to high-severity incidents requiring immediate deployment.</p>
                        <div className="flex items-center gap-2 text-white font-bold text-xs sm:text-sm uppercase tracking-wider group-hover:gap-3 transition-all">
                            View Alerts <ArrowRight size={16} />
                        </div>
                    </motion.div>

                    <motion.div 
                        whileHover={{ y: -6 }}
                        className="p-6 sm:p-10 bg-slate-900 group cursor-pointer rounded-3xl sm:rounded-[40px] shadow-lg transition-all text-white"
                        onClick={() => navigate(user.role === 'admin' ? '/admin' : '/department')}
                    >
                        <TrendingUp className="text-brand-blue mb-6" size={36} />
                        <h3 className="text-xl sm:text-2xl font-black text-white mb-2">City Trends</h3>
                        <p className="text-xs sm:text-sm text-slate-400 font-medium mb-6 leading-relaxed">Review departmental performance analytics and civic satisfaction trends.</p>
                        <div className="flex items-center gap-2 text-brand-blue font-bold text-xs sm:text-sm uppercase tracking-wider group-hover:gap-3 transition-all">
                            Open Console <ArrowRight size={16} />
                        </div>
                    </motion.div>
                </div>

                <div className="p-6 sm:p-10 bg-slate-50 border border-slate-100 rounded-3xl sm:rounded-[40px]">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                         <div className="max-w-lg">
                            <h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">Department Status</h2>
                            <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed italic">
                                "Efficiency in governance is the bridge between citizen voice and city action."
                            </p>
                         </div>
                         <div className="flex gap-3 w-full sm:w-auto">
                            <div className="flex-1 sm:flex-initial px-6 py-3 bg-white rounded-2xl border border-slate-100 text-center shadow-xs">
                                <p className="text-[9px] font-black text-brand-blue uppercase tracking-wider mb-0.5">Status</p>
                                <p className="text-base sm:text-lg font-black text-slate-900">Active</p>
                            </div>
                            <div className="flex-1 sm:flex-initial px-6 py-3 bg-brand-blue rounded-2xl text-center shadow-xs">
                                <p className="text-[9px] font-black text-blue-100 uppercase tracking-wider mb-0.5">Division</p>
                                <p className="text-base sm:text-lg font-black text-white">{user.department?.split(' ')[0]}</p>
                            </div>
                         </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthorityHome;
