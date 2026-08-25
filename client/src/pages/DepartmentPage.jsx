import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import HotspotMap from '../components/HotspotMap';
import BeforeAfterSlider from '../components/BeforeAfterSlider';
import ResolveModal from '../components/ResolveModal';
import toast from 'react-hot-toast';
import { 
    Clock, 
    Building2, 
    TrendingUp, 
    AlertCircle, 
    CheckCircle2, 
    Flame, 
    ShieldAlert, 
    Sparkles, 
    ChevronUp, 
    ChevronDown, 
    MapPin, 
    Award,
    Filter,
    Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const DepartmentPage = () => {
    const [allComplaints, setAllComplaints] = useState([]);
    const [deptScores, setDeptScores] = useState([]);
    const [selectedDept, setSelectedDept] = useState('All');
    const [viewMode, setViewMode] = useState('list'); // 'list' or 'trend'
    const [expandedEscalation, setExpandedEscalation] = useState(false);
    const [userLoc, setUserLoc] = useState(null);
    const [resolveModalComplaint, setResolveModalComplaint] = useState(null);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();

    const isAdmin = user?.role === 'admin' || user?.department === 'City Administration';

    const fetchData = async () => {
        try {
            const [deptCompRes, scoresRes] = await Promise.all([
                axios.get('http://localhost:5000/api/complaints/department', {
                    headers: { Authorization: `Bearer ${user.token}` }
                }),
                axios.get('http://localhost:5000/api/complaints/scores', {
                    headers: { Authorization: `Bearer ${user.token}` }
                })
            ]);
            setAllComplaints(deptCompRes.data.data || []);
            setDeptScores(scoresRes.data.data || []);
        } catch (err) {
            toast.error('Failed to sync department feed');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setUserLoc([pos.coords.latitude, pos.coords.longitude]),
                () => console.log('Location access denied')
            );
        }
    }, [user.token]);

    const handleUpdateStatus = async (id, status) => {
        try {
            await axios.patch(`http://localhost:5000/api/complaints/${id}/status`, { status }, {
                headers: { Authorization: `Bearer ${user.token}` }
            });
            toast.success(`Ticket updated to ${status}`);
            fetchData();
        } catch (err) {
            toast.error('Failed to update status');
        }
    };

    // Filter complaints based on user role and selection
    const currentDeptFilter = !isAdmin && user.department ? user.department : selectedDept;
    
    const displayComplaints = currentDeptFilter === 'All'
        ? allComplaints
        : allComplaints.filter(c => c.department === currentDeptFilter);

    // Dynamic Real-time Calculations for the Active View
    const totalReported = displayComplaints.length;
    const inProgressCount = displayComplaints.filter(c => c.status === 'In Progress').length;
    const assignedCount = displayComplaints.filter(c => c.status === 'Assigned' || c.status === 'Pending').length;
    const resolvedCount = displayComplaints.filter(c => c.status === 'Resolved').length;

    const overdueComplaints = displayComplaints.filter(
        c => c.deadline && new Date(c.deadline) < new Date() && c.status !== 'Resolved'
    );

    // K-Means Grouping
    const clusters = displayComplaints.reduce((acc, c) => {
        if (!c.clusterId && c.clusterId !== 0) return acc;
        if (!acc[c.clusterId]) acc[c.clusterId] = [];
        acc[c.clusterId].push(c);
        return acc;
    }, {});

    const departmentList = ['All', 'Sanitation', 'Water Supply', 'Electric Board', 'Public Works', 'Police', 'General'];

    return (
        <div className="min-h-screen pt-20 sm:pt-28 pb-28 sm:pb-24 bg-slate-50">
            <div className="container mx-auto px-4 sm:px-6">
                {/* Department Header */}
                <header className="mb-6 sm:mb-10">
                    <div className="flex items-center gap-1.5 text-brand-orange font-black uppercase text-[10px] sm:text-xs tracking-wider mb-2">
                        <Building2 size={14} /> Official Workforce Terminal
                    </div>
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 sm:gap-6">
                        <div>
                            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">
                                {currentDeptFilter === 'All' ? 'Municipal Operations' : currentDeptFilter} <span className="text-brand-orange">Workforce</span>
                            </h1>
                            <p className="text-slate-500 font-medium text-xs sm:text-sm mt-1">
                                Real-time operational work orders, live status counters, and AI anti-fraud resolution.
                            </p>
                        </div>

                        {/* View Switcher */}
                        <div className="flex gap-1.5 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-xs w-full sm:w-auto">
                            <button 
                                onClick={() => setViewMode('list')}
                                className={`flex-1 sm:flex-initial px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                    viewMode === 'list' ? 'bg-brand-blue text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'
                                }`}
                            >
                                Work Order Feed
                            </button>
                            <button 
                                onClick={() => setViewMode('trend')}
                                className={`flex-1 sm:flex-initial px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                    viewMode === 'trend' ? 'bg-brand-orange text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'
                                }`}
                            >
                                Hotspot Trends
                            </button>
                        </div>
                    </div>

                    {/* Admin Department Filter Tabs */}
                    {isAdmin && (
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-5 pt-4 border-t border-slate-200">
                            <span className="text-[11px] sm:text-xs font-black text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
                                <Filter size={13} /> Filter:
                            </span>
                            {departmentList.map(dept => (
                                <button
                                    key={dept}
                                    onClick={() => setSelectedDept(dept)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                        selectedDept === dept 
                                            ? 'bg-slate-900 text-white shadow-xs' 
                                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                                    }`}
                                >
                                    {dept}
                                </button>
                            ))}
                        </div>
                    )}
                </header>

                {/* 📊 REAL STATUS METRICS ROW */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-8 sm:mb-10">
                    <div className="card-premium p-4 sm:p-6 bg-white border border-slate-100 rounded-2xl sm:rounded-3xl shadow-xs">
                        <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Total Reported</p>
                        <p className="text-2xl sm:text-3xl font-black text-slate-900">{totalReported}</p>
                    </div>
                    <div className="card-premium p-4 sm:p-6 bg-white border border-amber-100 rounded-2xl sm:rounded-3xl shadow-xs">
                        <p className="text-[9px] sm:text-[10px] font-black text-amber-500 uppercase tracking-wider mb-0.5">In Progress ⚡</p>
                        <p className="text-2xl sm:text-3xl font-black text-amber-600">{inProgressCount}</p>
                    </div>
                    <div className="card-premium p-4 sm:p-6 bg-white border border-blue-100 rounded-2xl sm:rounded-3xl shadow-xs">
                        <p className="text-[9px] sm:text-[10px] font-black text-brand-blue uppercase tracking-wider mb-0.5">Pending ⏳</p>
                        <p className="text-2xl sm:text-3xl font-black text-brand-blue">{assignedCount}</p>
                    </div>
                    <div className="card-premium p-4 sm:p-6 bg-white border border-emerald-100 rounded-2xl sm:rounded-3xl shadow-xs">
                        <p className="text-[9px] sm:text-[10px] font-black text-emerald-500 uppercase tracking-wider mb-0.5">Solved ✅</p>
                        <p className="text-2xl sm:text-3xl font-black text-emerald-600">{resolvedCount}</p>
                    </div>
                </div>

                {/* Hotspot Map */}
                <div className="mb-8 sm:mb-12">
                    <HotspotMap complaints={displayComplaints} userLocation={userLoc} />
                </div>

                {/* Overdue SLA Alert */}
                <div className="mt-6 sm:mt-8">
                    <AnimatePresence>
                        {overdueComplaints.length > 0 && (
                            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                                <div className="card-premium bg-white border border-red-200 rounded-2xl sm:rounded-3xl overflow-hidden shadow-md shadow-red-500/10">
                                    <button 
                                        onClick={() => setExpandedEscalation(!expandedEscalation)} 
                                        className="w-full flex items-center justify-between p-4 sm:p-6 bg-red-50/70 hover:bg-red-50 transition-colors"
                                    >
                                        <div className="flex items-center gap-3 sm:gap-4 text-left min-w-0">
                                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-600 rounded-2xl flex items-center justify-center text-white flex-shrink-0">
                                                <AlertCircle size={20} className="animate-pulse" />
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="text-sm sm:text-lg font-black text-slate-900 truncate">SLA Breach Alert</h3>
                                                <p className="text-[11px] sm:text-xs font-bold text-red-600 uppercase tracking-wider truncate">
                                                    {overdueComplaints.length} tickets overdue past turnaround SLA
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <span className="text-[10px] sm:text-xs font-bold text-red-700 bg-white px-2.5 py-0.5 rounded-full border border-red-200">
                                                Overdue
                                            </span>
                                            {expandedEscalation ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                        </div>
                                    </button>

                                    <AnimatePresence>
                                        {expandedEscalation && (
                                            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="p-4 sm:p-8 border-t border-red-100 bg-red-50/20">
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                                                    {overdueComplaints.map(c => (
                                                        <DeptComplaintCard 
                                                            key={`overdue-${c._id}`} 
                                                            c={c} 
                                                            onUpdateStatus={handleUpdateStatus} 
                                                            onOpenResolve={setResolveModalComplaint} 
                                                        />
                                                    ))}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Feed View vs Trend View */}
                    {viewMode === 'list' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                            {displayComplaints.length > 0 ? (
                                displayComplaints.map(c => (
                                    <DeptComplaintCard 
                                        key={c._id} 
                                        c={c} 
                                        onUpdateStatus={handleUpdateStatus} 
                                        onOpenResolve={setResolveModalComplaint} 
                                    />
                                ))
                            ) : (
                                <div className="col-span-full py-16 sm:py-24 text-center bg-white rounded-3xl border border-dashed border-slate-200">
                                    <CheckCircle2 size={40} className="text-slate-300 mx-auto mb-2" />
                                    <h3 className="text-base sm:text-lg font-bold text-slate-700">All Protocols Cleared</h3>
                                    <p className="text-xs text-slate-400 mt-1">No active work orders in this division queue.</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {Object.keys(clusters).length > 0 ? (
                                Object.keys(clusters).map(cid => (
                                    <div key={cid} className="card-premium p-4 sm:p-6 bg-white border border-slate-100 rounded-3xl shadow-xs">
                                        <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-100 text-brand-orange rounded-2xl flex items-center justify-center font-bold flex-shrink-0">
                                                <Flame size={20} />
                                            </div>
                                            <div>
                                                <h3 className="text-base sm:text-lg font-black text-slate-900">Hotspot Cluster #{cid}</h3>
                                                <p className="text-[11px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider">{clusters[cid].length} nearby complaints</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                                            {clusters[cid].map(c => (
                                                <DeptComplaintCard 
                                                    key={c._id} 
                                                    c={c} 
                                                    onUpdateStatus={handleUpdateStatus} 
                                                    onOpenResolve={setResolveModalComplaint} 
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-16 sm:py-20 bg-white rounded-3xl border border-slate-100">
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">No recurring cluster hotspots detected</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* AI Resolution Modal */}
            <ResolveModal 
                complaint={resolveModalComplaint}
                isOpen={!!resolveModalComplaint}
                onClose={() => setResolveModalComplaint(null)}
                onSuccess={fetchData}
                token={user.token}
            />
        </div>
    );
};

const DeptComplaintCard = ({ c, onUpdateStatus, onOpenResolve }) => {
    const [statusVal, setStatusVal] = useState(c.status);

    const handleApplyStatus = () => {
        if (statusVal === 'Resolved') {
            onOpenResolve(c);
        } else {
            onUpdateStatus(c._id, statusVal);
        }
    };

    return (
        <div className="card-premium p-5 sm:p-6 bg-white border border-slate-100 rounded-3xl shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
            <div>
                <div className="flex justify-between items-start mb-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black uppercase tracking-wider ${
                        c.status === 'Resolved' 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : 'bg-blue-50 text-brand-blue border border-blue-200'
                    }`}>
                        {c.status}
                    </span>

                    <span className={`px-2 py-0.5 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-wider ${
                        c.priority === 'High' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-slate-50 text-slate-500'
                    }`}>
                        {c.priority} Priority
                    </span>
                </div>

                <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-3 leading-snug">{c.title}</h3>

                {c.status === 'Resolved' || c.resolutionImageUrl ? (
                    <BeforeAfterSlider 
                        beforeImage={c.imageUrl}
                        afterImage={c.resolutionImageUrl}
                        verificationStatus={c.verificationStatus}
                        verificationScore={c.verificationScore}
                        verificationVerdict={c.verificationVerdict}
                        fraudAuditFlag={c.fraudAuditFlag}
                    />
                ) : c.imageUrl ? (
                    <div className="h-40 sm:h-44 rounded-2xl overflow-hidden bg-slate-100 mb-3">
                        <img src={c.imageUrl} alt="Issue evidence" className="w-full h-full object-cover" />
                    </div>
                ) : null}

                {c.fraudAuditFlag && c.status !== 'Resolved' && (
                    <div className="p-2.5 mb-3 bg-red-50 border border-red-200 rounded-xl text-[11px] text-red-800 font-medium">
                        ⚠️ <strong>AI Inspection Warning:</strong> Previous closure was rejected.
                    </div>
                )}

                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium truncate mb-3">
                    <MapPin size={13} className="flex-shrink-0" />
                    <span className="truncate">{c.location || 'Local territory'}</span>
                </div>
            </div>

            <div className="pt-3 border-t border-slate-100">
                {c.deadline && (
                    <div className="flex justify-between items-center text-xs mb-3">
                        <span className="text-slate-400 font-bold uppercase text-[9px]">Deadline</span>
                        <span className={`text-[11px] font-bold ${new Date(c.deadline) < new Date() && c.status !== 'Resolved' ? 'text-red-500' : 'text-slate-700'}`}>
                            {new Date(c.deadline).toLocaleDateString()} {new Date(c.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                )}

                {c.status !== 'Resolved' && (
                    <div className="space-y-2">
                        <div className="flex gap-2">
                            <select 
                                value={statusVal} 
                                onChange={(e) => setStatusVal(e.target.value)}
                                className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
                            >
                                <option value="Assigned">Assigned</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Resolved">Resolved (AI Scan)</option>
                            </select>
                            <button 
                                onClick={handleApplyStatus}
                                className="p-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors"
                                title="Update Status"
                            >
                                <CheckCircle2 size={16} />
                            </button>
                        </div>

                        <button 
                            onClick={() => onOpenResolve(c)}
                            className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95"
                        >
                            <Sparkles size={13} /> Resolve with AI Proof
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DepartmentPage;
