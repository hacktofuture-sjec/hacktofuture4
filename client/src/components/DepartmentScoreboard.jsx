import React from 'react';
import { 
    Award, 
    TrendingUp, 
    ShieldCheck, 
    Clock, 
    AlertTriangle, 
    CheckCircle2, 
    Flame,
    FileText,
    Activity
} from 'lucide-react';

export const DepartmentScoreboard = ({ scores = [], highlightedDept = null, title = "Cross-Department Performance Scoreboard" }) => {
    if (!scores || scores.length === 0) return null;

    return (
        <div className="card-premium p-4 sm:p-8 bg-white border border-slate-100 shadow-xl rounded-2xl sm:rounded-3xl mb-8 sm:mb-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
                <div>
                    <div className="flex items-center gap-1.5 text-brand-orange text-[10px] sm:text-xs font-black uppercase tracking-wider mb-1">
                        <Award size={15} /> Live Municipal Accountability Radar
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{title}</h2>
                </div>
                <div className="px-3 py-1.5 sm:px-4 sm:py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] sm:text-xs text-slate-500 font-medium">
                    Formula: <strong>45% Resolution</strong> + <strong>35% On-Time SLA</strong> + <strong>20% AI Quality</strong>
                </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {scores.map((s, idx) => {
                    const isHighlighted = highlightedDept && s.department.toLowerCase().includes(highlightedDept.toLowerCase());
                    const isGradeA = s.grade?.startsWith('A');
                    const isGradeB = s.grade === 'B';

                    return (
                        <div 
                            key={s.department}
                            className={`p-4 sm:p-6 rounded-2xl sm:rounded-3xl border transition-all relative overflow-hidden flex flex-col justify-between ${
                                isHighlighted 
                                    ? 'bg-blue-50/60 border-brand-blue ring-2 ring-brand-blue/30 shadow-lg' 
                                    : 'bg-slate-50/70 border-slate-100 hover:bg-white hover:shadow-md'
                            }`}
                        >
                            {/* Department Header & Grade */}
                            <div>
                                <div className="flex justify-between items-start mb-3 sm:mb-4">
                                    <div>
                                        <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                            Rank #{idx + 1}
                                        </span>
                                        <h3 className="text-base sm:text-lg font-black text-slate-900 leading-tight">{s.department}</h3>
                                    </div>
                                    <div className={`px-2.5 py-1 rounded-xl text-[11px] sm:text-xs font-black shadow-xs ${
                                        isGradeA 
                                            ? 'bg-emerald-500 text-white' 
                                            : isGradeB 
                                                ? 'bg-brand-blue text-white' 
                                                : 'bg-amber-500 text-white'
                                    }`}>
                                        Grade {s.grade}
                                    </div>
                                </div>

                                {/* Score Bar */}
                                <div className="my-2.5 sm:my-3">
                                    <div className="flex justify-between items-baseline mb-1">
                                        <span className="text-[11px] sm:text-xs font-bold text-slate-500">Accountability Score</span>
                                        <span className="text-xl sm:text-2xl font-black text-slate-900">
                                            {s.performanceScore}<span className="text-xs text-slate-400 font-bold">/100</span>
                                        </span>
                                    </div>
                                    <div className="w-full h-2 sm:h-2.5 bg-slate-200 rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full rounded-full transition-all duration-1000 ${
                                                isGradeA 
                                                    ? 'bg-emerald-500' 
                                                    : isGradeB 
                                                        ? 'bg-brand-blue' 
                                                        : 'bg-amber-500'
                                            }`}
                                            style={{ width: `${s.performanceScore}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Counts Breakdown */}
                                <div className="grid grid-cols-4 gap-1 pt-2 pb-1.5 my-2 text-center bg-white/90 rounded-xl border border-slate-200/70 p-1.5">
                                    <div>
                                        <p className="text-[7px] sm:text-[8px] font-black text-slate-400 uppercase">Reported</p>
                                        <p className="text-xs sm:text-sm font-black text-slate-900">{s.total}</p>
                                    </div>
                                    <div>
                                        <p className="text-[7px] sm:text-[8px] font-black text-amber-500 uppercase">Active</p>
                                        <p className="text-xs sm:text-sm font-black text-amber-600">{s.inProgress}</p>
                                    </div>
                                    <div>
                                        <p className="text-[7px] sm:text-[8px] font-black text-blue-500 uppercase">Assigned</p>
                                        <p className="text-xs sm:text-sm font-black text-blue-600">{s.assigned}</p>
                                    </div>
                                    <div>
                                        <p className="text-[7px] sm:text-[8px] font-black text-emerald-500 uppercase">Solved</p>
                                        <p className="text-xs sm:text-sm font-black text-emerald-600">{s.resolved}</p>
                                    </div>
                                </div>

                                {/* Rates Breakdown */}
                                <div className="grid grid-cols-3 gap-1.5 mt-2 text-center">
                                    <div className="p-1.5 sm:p-2 bg-white rounded-lg sm:rounded-xl border border-slate-100">
                                        <p className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase">Resolution</p>
                                        <p className="text-[11px] sm:text-xs font-black text-slate-800">{s.resolutionRate}%</p>
                                    </div>
                                    <div className="p-1.5 sm:p-2 bg-white rounded-lg sm:rounded-xl border border-slate-100">
                                        <p className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase">SLA On-Time</p>
                                        <p className="text-[11px] sm:text-xs font-black text-slate-800">{s.slaComplianceRate}%</p>
                                    </div>
                                    <div className="p-1.5 sm:p-2 bg-white rounded-lg sm:rounded-xl border border-slate-100">
                                        <p className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase">AI Quality</p>
                                        <p className="text-[11px] sm:text-xs font-black text-slate-800">{s.aiQualityScore}%</p>
                                    </div>
                                </div>
                            </div>

                            {/* Badge */}
                            <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-[10px] sm:text-[11px] font-bold">
                                <span className="text-slate-400 truncate mr-2">
                                    {s.auditFlagsCount > 0 ? `⚠️ ${s.auditFlagsCount} Flag` : '✓ 0 Flags'}
                                </span>
                                <span className="text-brand-blue bg-blue-50 px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] flex-shrink-0">
                                    {s.badge}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default DepartmentScoreboard;
