import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import HotspotMap from '../components/HotspotMap';
import DepartmentScoreboard from '../components/DepartmentScoreboard';
import BeforeAfterSlider from '../components/BeforeAfterSlider';
import toast from 'react-hot-toast';
import { 
    Building2, 
    ShieldAlert, 
    TrendingUp, 
    AlertCircle, 
    CheckCircle2, 
    Flame, 
    Award, 
    Activity, 
    MapPin,
    Search
} from 'lucide-react';
import { motion } from 'framer-motion';

const AdminPage = () => {
    const [allComplaints, setAllComplaints] = useState([]);
    const [deptScores, setDeptScores] = useState([]);
    const [stats, setStats] = useState(null);
    const [userLoc, setUserLoc] = useState(null);
    const [selectedDeptFilter, setSelectedDeptFilter] = useState('All');
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();

    useEffect(() => {
        const fetchAdminData = async () => {
            try {
                const [compRes, scoresRes, statsRes] = await Promise.all([
                    axios.get('http://localhost:5000/api/complaints/all', {
                        headers: { Authorization: `Bearer ${user.token}` }
                    }),
                    axios.get('http://localhost:5000/api/complaints/scores', {
                        headers: { Authorization: `Bearer ${user.token}` }
                    }),
                    axios.get('http://localhost:5000/api/complaints/stats', {
                        headers: { Authorization: `Bearer ${user.token}` }
                    })
                ]);
                setAllComplaints(compRes.data.data || []);
                setDeptScores(scoresRes.data.data || []);
                setStats(statsRes.data.data || null);
            } catch (err) {
                toast.error('Failed to connect to Admin Matrix');
            } finally {
                setLoading(false);
            }
        };
        fetchAdminData();

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setUserLoc([pos.coords.latitude, pos.coords.longitude]),
                () => console.log('Location denied')
            );
        }
    }, [user.token]);

    const highPriorityCount = allComplaints.filter(c => c.priority === 'High').length;
    const resolvedCount = allComplaints.filter(c => c.status === 'Resolved').length;
    const fraudAuditComplaints = allComplaints.filter(c => c.fraudAuditFlag);

    const filteredComplaints = selectedDeptFilter === 'All' 
        ? allComplaints 
        : allComplaints.filter(c => c.department === selectedDeptFilter);

    return (
        <div className="min-h-screen pt-20 sm:pt-28 pb-28 sm:pb-24 bg-slate-50">
            <div className="container mx-auto px-4 sm:px-6">
                {/* Admin Header */}
                <header className="mb-8 sm:mb-12">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-900 text-white rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider mb-3 shadow-xs">
                        <Activity size={13} className="text-brand-orange animate-pulse" /> City Executive Command Matrix
                    </div>
                    <h1 className="text-3xl sm:text-4xl lg:text-6xl font-black text-slate-900 tracking-tight">
                        City Administration <span className="text-brand-blue">Portal.</span>
                    </h1>
                    <p className="text-slate-500 font-medium text-xs sm:text-base mt-1.5 sm:mt-2">
                        Cross-department accountability rankings, AI anti-fraud audit radar, and city-wide resolution intelligence.
                    </p>
                </header>

                {/* Top Metrics Row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-8 sm:mb-12">
                    <div className="card-premium p-4 sm:p-6 bg-white border-l-4 border-brand-blue rounded-2xl sm:rounded-3xl shadow-xs">
                        <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Total Complaints</p>
                        <p className="text-2xl sm:text-4xl font-black text-slate-900">{allComplaints.length}</p>
                    </div>
                    <div className="card-premium p-4 sm:p-6 bg-white border-l-4 border-red-500 rounded-2xl sm:rounded-3xl shadow-xs">
                        <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">High Priority 🚨</p>
                        <p className="text-2xl sm:text-4xl font-black text-red-500">{highPriorityCount}</p>
                    </div>
                    <div className="card-premium p-4 sm:p-6 bg-white border-l-4 border-emerald-500 rounded-2xl sm:rounded-3xl shadow-xs">
                        <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">AI Resolved</p>
                        <p className="text-2xl sm:text-4xl font-black text-emerald-500">{resolvedCount}</p>
                    </div>
                    <div className="card-premium p-4 sm:p-6 bg-white border-l-4 border-purple-500 rounded-2xl sm:rounded-3xl shadow-xs">
                        <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Audit Flags</p>
                        <p className="text-2xl sm:text-4xl font-black text-purple-600">{fraudAuditComplaints.length}</p>
                    </div>
                </div>

                {/* 🏆 Full Cross-Department Performance Scoreboard */}
                <DepartmentScoreboard 
                    scores={deptScores} 
                    title="Cross-Department Performance Scoreboard & Rankings" 
                />

                {/* 🚨 AI Anti-Fraud / Suspicious Closure Watchlist */}
                {fraudAuditComplaints.length > 0 && (
                    <div className="card-premium p-5 sm:p-8 bg-red-50/60 border border-red-200 rounded-2xl sm:rounded-3xl mb-8 sm:mb-12 shadow-xs">
                        <div className="flex items-center gap-3 mb-4 sm:mb-6">
                            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-red-600 text-white flex items-center justify-center flex-shrink-0">
                                <ShieldAlert size={20} />
                            </div>
                            <div>
                                <h2 className="text-lg sm:text-xl font-black text-slate-900">AI Anti-Fraud Watchlist</h2>
                                <p className="text-[11px] sm:text-xs text-red-700 font-bold uppercase tracking-wider">
                                    {fraudAuditComplaints.length} tickets where AI rejected fake worker resolution
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                            {fraudAuditComplaints.map(c => (
                                <div key={c._id} className="p-4 sm:p-6 bg-white border border-red-200 rounded-2xl shadow-xs flex flex-col justify-between">
                                    <div>
                                        <div className="flex justify-between items-start mb-2.5">
                                            <span className="text-[10px] font-black uppercase text-red-600 bg-red-50 px-2 py-0.5 rounded">
                                                {c.department}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-400">Ref: #{c._id.slice(-6)}</span>
                                        </div>
                                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 mb-2">{c.title}</h4>
                                        <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-[11px] text-red-900 font-medium mb-3">
                                            ⚠️ <strong>AI Verdict:</strong> {c.verificationVerdict || 'Incomplete resolution detected in uploaded photo.'}
                                        </div>
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
                                            <div className="h-36 sm:h-40 rounded-xl overflow-hidden bg-slate-100 mb-3 relative group border border-slate-200">
                                                <img 
                                                    src={c.imageUrl} 
                                                    alt="Complaint Evidence" 
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                        ) : null}
                                    </div>
                                    <p className="text-[10px] sm:text-[11px] text-slate-400 flex items-center gap-1 mt-2">
                                        <MapPin size={12} /> {c.location || 'Local territory'}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Hotspot Geospatial Map */}
                <div className="mb-8 sm:mb-12">
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-3 sm:mb-4 tracking-tight">Geospatial Intelligence Map</h2>
                    <HotspotMap complaints={allComplaints} userLocation={userLoc} />
                </div>

                {/* City-Wide Incident Logs */}
                <div className="card-premium p-5 sm:p-8 bg-white border border-slate-100 rounded-2xl sm:rounded-3xl shadow-md">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
                        <div>
                            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">All Department Incident Logs</h2>
                            <p className="text-xs text-slate-400 font-medium">Filter and inspect any ticket across the entire municipal administration</p>
                        </div>

                        {/* Filter by Department */}
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <span className="text-xs font-bold text-slate-500 uppercase whitespace-nowrap">Division:</span>
                            <select 
                                value={selectedDeptFilter} 
                                onChange={(e) => setSelectedDeptFilter(e.target.value)}
                                className="w-full sm:w-auto px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
                            >
                                <option value="All">All Departments</option>
                                <option value="Sanitation">Sanitation</option>
                                <option value="Water Supply">Water Supply</option>
                                <option value="Electric Board">Electric Board</option>
                                <option value="Public Works">Public Works</option>
                                <option value="Police">Police</option>
                                <option value="General">General</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                        {filteredComplaints.slice(0, 30).map(c => (
                            <div key={c._id} className="p-4 sm:p-6 bg-slate-50/70 border border-slate-100 rounded-2xl hover:bg-white hover:shadow-sm transition-all flex flex-col justify-between">
                                <div>
                                    <div className="flex justify-between items-start mb-2.5">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                            c.status === 'Resolved' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                                        }`}>
                                            {c.status}
                                        </span>
                                        <span className="text-[10px] font-black text-brand-orange uppercase">{c.department}</span>
                                    </div>
                                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 mb-2.5">{c.title}</h4>

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
                                        <div className="h-36 sm:h-40 rounded-xl overflow-hidden bg-slate-100 mb-3 relative group border border-slate-200/60 shadow-inner">
                                            <img 
                                                src={c.imageUrl} 
                                                alt="Complaint Evidence" 
                                                className="w-full h-full object-cover" 
                                            />
                                        </div>
                                    ) : null}
                                </div>
                                <div className="pt-2.5 border-t border-slate-200/60 mt-2 flex justify-between text-[10px] sm:text-[11px] text-slate-400 font-medium">
                                    <span>Priority: <strong className={c.priority === 'High' ? 'text-red-500 font-bold' : 'text-slate-700'}>{c.priority}</strong></span>
                                    <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminPage;
