import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { 
    LayoutDashboard, 
    ChevronDown, 
    ChevronUp, 
    Building2, 
    AlertCircle, 
    CheckCircle2, 
    Clock,
    MapPin,
    ArrowRight,
    Flame,
    Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

import HotspotMap from '../components/HotspotMap';

const ExecutiveView = () => {
    const [allComplaints, setAllComplaints] = useState([]);
    const [stats, setStats] = useState(null);
    const [expandedDept, setExpandedDept] = useState(null);
    const [expandedCluster, setExpandedCluster] = useState(null);
    const [userLoc, setUserLoc] = useState(null);
    const { user } = useAuth();

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [complaintsRes, statsRes] = await Promise.all([
                    axios.get('http://localhost:5000/api/complaints/all', { headers: { Authorization: `Bearer ${user.token}` } }),
                    axios.get('http://localhost:5000/api/complaints/stats', { headers: { Authorization: `Bearer ${user.token}` } })
                ]);
                setAllComplaints(complaintsRes.data.data);
                setStats(statsRes.data.data);
            } catch (err) {
                toast.error('Insight Link Failed');
            }
        };
        fetchData();

        // Optional: Get current location for map
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setUserLoc([pos.coords.latitude, pos.coords.longitude]),
                () => console.log('Location denied')
            );
        }
    }, [user.token]);

    const depts = ['Sanitation', 'Water Supply', 'Electric Board', 'Public Works', 'Police', 'General'];
    
    const getPriorityCount = (p) => allComplaints.filter(c => c.priority === p).length;

    // K-Means Grouping
    const clusters = allComplaints.reduce((acc, c) => {
        if (!c.clusterId && c.clusterId !== 0) return acc;
        if (!acc[c.clusterId]) acc[c.clusterId] = [];
        acc[c.clusterId].push(c);
        return acc;
    }, {});

    return (
        <div className="min-h-screen pt-32 pb-20 bg-slate-50">
            <div className="container mx-auto px-6">
                <header className="mb-16">
                    <h1 className="text-5xl font-black text-slate-900 tracking-tighter mb-4 italic uppercase">City <span className="text-brand-blue">Executive</span> Insights.</h1>
                    <p className="text-slate-500 font-medium tracking-tight">Global overwatch of all departmental protocols and AI-driven hotspot analysis.</p>
                </header>

                <HotspotMap complaints={allComplaints} userLocation={userLoc} />

                {/* Top Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 my-16">
                    <div className="card-premium p-8 border-l-8 border-brand-blue bg-white shadow-xl">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2">Total Volume</p>
                        <p className="text-4xl font-black text-slate-900">{allComplaints.length}</p>
                    </div>
                    <div className="card-premium p-8 border-l-8 border-red-500 bg-white shadow-xl">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2">High Priority 🚨</p>
                        <p className="text-4xl font-black text-red-500">{getPriorityCount('High')}</p>
                    </div>
                    <div className="card-premium p-8 border-l-8 border-brand-orange bg-white shadow-xl">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2">Medium Priority</p>
                        <p className="text-4xl font-black text-brand-orange">{getPriorityCount('Medium')}</p>
                    </div>
                    <div className="card-premium p-8 border-l-8 border-emerald-500 bg-white shadow-xl">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2">Resolved</p>
                        <p className="text-4xl font-black text-emerald-500">{allComplaints.filter(c => c.status === 'Resolved').length}</p>
                    </div>
                </div>

                {/* 🎯 AI CLUSTER HOTSPOTS SECTION */}
                <div className="mb-20">
                    <h2 className="text-2xl font-black text-slate-900 mb-8 italic uppercase tracking-tighter flex items-center gap-3">
                        <Flame className="text-brand-orange" /> AI-Driven Hotspot Trends
                    </h2>
                    
                    <div className="grid gap-4">
                        {Object.keys(clusters).filter(cid => clusters[cid].length > 1).map((cid) => {
                            const clusterReports = clusters[cid];
                            const isExpanded = expandedCluster === cid;
                            return (
                                <div key={cid} className="card-premium bg-white shadow-lg overflow-hidden border-2 border-slate-100">
                                    <button 
                                        onClick={() => setExpandedCluster(isExpanded ? null : cid)}
                                        className="w-full flex items-center justify-between p-8 hover:bg-slate-50 transition-colors"
                                    >
                                        <div className="flex items-center gap-6">
                                            <div className="w-12 h-12 bg-orange-100 text-brand-orange rounded-xl flex items-center justify-center">
                                                <Zap size={20} className={clusterReports.length > 5 ? 'animate-pulse' : ''} />
                                            </div>
                                            <div className="text-left">
                                                <h3 className="text-lg font-black text-slate-900 leading-none mb-1">City Pattern Hub #{cid}</h3>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{clusterReports.length} Similar Reports across {new Set(clusterReports.map(r => r.department)).size} departments</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="px-3 py-1 bg-slate-50 text-slate-400 text-[10px] font-black rounded-full border border-slate-100">Review Pattern</span>
                                            {isExpanded ? <ChevronUp /> : <ChevronDown />}
                                        </div>
                                    </button>
                                    <AnimatePresence>
                                        {isExpanded && (
                                            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="p-8 bg-slate-50/50 border-t border-slate-100 overflow-x-auto">
                                                <table className="w-full text-left">
                                                    <thead>
                                                        <tr className="text-[10px] font-black text-slate-300 uppercase tracking-widest border-b border-slate-100">
                                                            <th className="pb-4">Dept</th>
                                                            <th className="pb-4">Priority</th>
                                                            <th className="pb-4">Title</th>
                                                            <th className="pb-4">Location</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {clusterReports.map(c => (
                                                            <tr key={c._id} className="group hover:bg-white transition-all">
                                                                <td className="py-4 text-xs font-black text-brand-blue uppercase">{c.department}</td>
                                                                <td className={`py-4 text-xs font-black uppercase ${c.priority === 'High' ? 'text-red-500' : 'text-slate-400'}`}>{c.priority}</td>
                                                                <td className="py-4 text-sm font-bold text-slate-800">{c.title}</td>
                                                                <td className="py-4 text-[10px] font-black text-slate-400 uppercase">{c.location}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* 🏢 DEPARTMENTAL FLOW SECTION */}
                <div className="space-y-6">
                    <h2 className="text-2xl font-black text-slate-900 mb-8 italic uppercase tracking-tighter flex items-center gap-3">
                        <Building2 className="text-brand-blue" /> Divisional Control Folders
                    </h2>
                    
                    {depts.map((dept) => {
                        const deptComplaints = allComplaints.filter(c => c.department === dept);
                        const isExpanded = expandedDept === dept;

                        return (
                            <div key={dept} className="card-premium bg-white shadow-lg overflow-hidden transition-all duration-300 border border-slate-50">
                                <button 
                                    onClick={() => setExpandedDept(isExpanded ? null : dept)}
                                    className="w-full flex items-center justify-between p-8 hover:bg-slate-50 transition-colors"
                                >
                                    <div className="flex items-center gap-6">
                                        <div className={`p-4 rounded-2xl ${deptComplaints.length > 0 ? 'bg-brand-blue/10 text-brand-blue' : 'bg-slate-100 text-slate-400'}`}>
                                            <Building2 size={24} />
                                        </div>
                                        <div className="text-left">
                                            <h3 className="text-xl font-black text-slate-900 tracking-tighter">{dept}</h3>
                                            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">{deptComplaints.length} active files in system</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {deptComplaints.some(c => c.priority === 'High') && (
                                            <span className="px-3 py-1 bg-red-50 text-red-500 text-[10px] font-black rounded-full uppercase tracking-widest animate-pulse border border-red-100">Critical</span>
                                        )}
                                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                    </div>
                                </button>

                                <AnimatePresence>
                                    {isExpanded && (
                                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-slate-50 bg-slate-50/50">
                                            <div className="p-8">
                                                {deptComplaints.length > 0 ? (
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-left">
                                                            <thead>
                                                                <tr className="text-[10px] font-black text-slate-300 uppercase tracking-widest border-b border-slate-100">
                                                                    <th className="pb-4">Case #</th>
                                                                    <th className="pb-4">Status</th>
                                                                    <th className="pb-4">Priority</th>
                                                                    <th className="pb-4">Title</th>
                                                                    <th className="pb-4">Location</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-100">
                                                                {deptComplaints.map((c) => (
                                                                    <tr key={c._id} className="group hover:bg-white transition-all">
                                                                        <td className="py-4 text-xs font-bold text-slate-400">{c._id.slice(-6)}</td>
                                                                        <td className="py-4">
                                                                             <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${c.status === 'Resolved' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-blue-50 text-brand-blue border-blue-100'}`}>
                                                                                {c.status}
                                                                            </span>
                                                                        </td>
                                                                        <td className="py-4 text-xs font-black italic uppercase tracking-tighter" style={{ color: c.priority === 'High' ? '#ef4444' : '#64748b'}}>
                                                                            {c.priority}
                                                                        </td>
                                                                        <td className="py-4 font-bold text-slate-700">{c.title}</td>
                                                                        <td className="py-4 text-[10px] font-black text-slate-400 uppercase">
                                                                            {c.location}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                ) : (
                                                    <div className="text-center py-10">
                                                        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em]">Operational Peace - No Active Reports</p>
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default ExecutiveView;
