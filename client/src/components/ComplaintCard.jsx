import React from 'react';
import { Clock, Activity, Briefcase, Hash } from 'lucide-react';
import { motion } from 'framer-motion';

export const StatusBadge = ({ status }) => {
    const styles = {
        'Pending': 'border-slate-500/20 text-slate-400 bg-slate-500/5 shadow-[0_0_10px_rgba(100,116,139,0.1)]',
        'Assigned': 'border-blue-500/20 text-blue-400 bg-blue-500/5 shadow-[0_0_10px_rgba(59,130,246,0.1)]',
        'In Progress': 'border-amber-500/20 text-amber-400 bg-amber-500/5 shadow-[0_0_10px_rgba(245,158,11,0.1)]',
        'Resolved': 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5 shadow-[0_0_10px_rgba(16,185,129,0.1)]'
    };
    return (
        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${styles[status]}`}>
            {status}
        </span>
    );
};

const ComplaintCard = ({ c, isDepartment = false, onUpdateStatus, index }) => {
    const severityMap = {
        'High': 'text-red-400 border-red-500/20 bg-red-500/5',
        'Medium': 'text-amber-400 border-amber-500/20 bg-amber-500/5',
        'Low': 'text-slate-400 border-slate-500/20 bg-slate-500/5'
    };

    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="premium-card p-8 group relative overflow-hidden h-full flex flex-col"
        >
            <div className="flex justify-between items-start mb-8">
                <StatusBadge status={c.status} />
                <div className={`px-2.5 py-1 rounded-md text-[9px] font-black border uppercase tracking-widest ${severityMap[c.severity]}`}>
                    {c.severity} Priority
                </div>
            </div>

            <div className="mb-auto">
                <h3 className="text-xl font-bold text-white leading-tight mb-4 group-hover:text-blue-400 transition-colors">
                    {c.text}
                </h3>
                <div className="flex flex-wrap gap-2 mb-8">
                    {c.keywords?.slice(0, 3).map(k => (
                        <span key={k} className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded border border-white/5">
                            #{k}
                        </span>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-y-4 pt-6 border-t border-white/5">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-500">
                        <Activity size={14} />
                    </div>
                    <div>
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Category</p>
                        <p className="text-sm font-bold text-slate-200">{c.category}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-500">
                        <Briefcase size={14} />
                    </div>
                    <div>
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Department</p>
                        <p className="text-sm font-bold text-blue-400">{c.department}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-500">
                        <Clock size={14} />
                    </div>
                    <div>
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Submitted</p>
                        <p className="text-sm font-bold text-slate-200">{new Date(c.createdAt).toLocaleDateString()}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-500">
                        <Hash size={14} />
                    </div>
                    <div>
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Cluster ID</p>
                        <p className="text-sm font-bold text-slate-200">#0{c.clusterId}</p>
                    </div>
                </div>
            </div>

            {isDepartment && c.status !== 'Resolved' && (
                <div className="flex gap-2 mt-8 pt-6 border-t border-white/5">
                    <button 
                        onClick={() => onUpdateStatus(c._id, 'In Progress')}
                        className="flex-1 py-3 bg-white/5 hover:bg-amber-500/20 text-amber-500 rounded-xl text-xs font-black uppercase tracking-widest transition-all border border-white/5 hover:border-amber-500/20"
                    >
                        Initialize
                    </button>
                    <button 
                        onClick={() => onUpdateStatus(c._id, 'Resolved')}
                        className="flex-1 py-3 bg-blue-600/10 hover:bg-emerald-500/20 text-emerald-500 rounded-xl text-xs font-black uppercase tracking-widest transition-all border border-blue-500/20 hover:border-emerald-500/20"
                    >
                        Finalize
                    </button>
                </div>
            )}
        </motion.div>
    );
};

export default ComplaintCard;
