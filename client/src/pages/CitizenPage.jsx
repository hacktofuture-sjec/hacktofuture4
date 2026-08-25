import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { 
    Trophy, 
    PlusCircle, 
    Clock, 
    CheckCircle2, 
    AlertCircle, 
    Sparkles, 
    Building2, 
    Filter,
    MapPin,
    ArrowRight 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import BeforeAfterSlider from '../components/BeforeAfterSlider';
import toast from 'react-hot-toast';

const CitizenPage = () => {
    const [complaints, setComplaints] = useState([]);
    const [filter, setFilter] = useState('all'); // 'all', 'pending', 'resolved'
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const loadData = async () => {
            try {
                const compRes = await axios.get('http://localhost:5000/api/complaints/my', {
                    headers: { Authorization: `Bearer ${user.token}` }
                });
                setComplaints(compRes.data.data || []);
            } catch (err) {
                toast.error('Failed to load your complaints');
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [user.token]);

    const resolvedCount = complaints.filter(c => c.status === 'Resolved').length;
    const inProgressCount = complaints.filter(c => c.status !== 'Resolved').length;

    const filteredComplaints = complaints.filter(c => {
        if (filter === 'resolved') return c.status === 'Resolved';
        if (filter === 'pending') return c.status !== 'Resolved';
        return true;
    });

    return (
        <div className="min-h-screen pt-20 sm:pt-28 pb-28 sm:pb-24 bg-slate-50">
            <div className="container mx-auto px-4 sm:px-6">
                {/* Hero Header */}
                <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 sm:gap-8 mb-8 sm:mb-12">
                    <div>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-brand-blue rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider mb-3 border border-blue-100">
                            <Building2 size={13} /> Citizen Civic Portal
                        </div>
                        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">
                            Welcome, <span className="text-brand-blue">{user?.name || 'Citizen'}</span>
                        </h1>
                        <p className="text-slate-500 font-medium text-xs sm:text-base mt-1.5 sm:mt-2">
                            Track your reported civic issues and inspect Before/After resolution evidence in real-time.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 w-full sm:w-auto">
                        <Link 
                            to="/rewards"
                            className="card-premium px-4 py-2.5 sm:px-6 sm:py-3.5 bg-white border border-orange-100 rounded-2xl flex items-center gap-2.5 sm:gap-3 shadow-sm hover:shadow-md transition-all flex-1 sm:flex-initial"
                        >
                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-orange-100 text-brand-orange flex items-center justify-center font-black flex-shrink-0">
                                <Trophy size={18} />
                            </div>
                            <div>
                                <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider leading-none">Reward Points</p>
                                <p className="text-base sm:text-xl font-black text-brand-orange leading-tight">{user?.rewardPoints || 0} Pts</p>
                            </div>
                        </Link>

                        <button 
                            onClick={() => navigate('/report')}
                            className="px-4 py-3 sm:px-6 sm:py-4 bg-brand-blue hover:bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex-1 sm:flex-initial"
                        >
                            <PlusCircle size={16} /> Raise Complaint
                        </button>
                    </div>
                </header>

                {/* Quick Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-12">
                    <div className="card-premium p-4 sm:p-6 bg-white border border-slate-100 rounded-2xl shadow-xs">
                        <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Reports Filed</p>
                        <p className="text-2xl sm:text-3xl font-black text-slate-900">{complaints.length}</p>
                    </div>
                    <div className="card-premium p-4 sm:p-6 bg-white border border-amber-100 rounded-2xl shadow-xs">
                        <p className="text-[10px] sm:text-xs font-bold text-amber-500 uppercase tracking-wider mb-1">Active / Assigned</p>
                        <p className="text-2xl sm:text-3xl font-black text-amber-600">{inProgressCount}</p>
                    </div>
                    <div className="card-premium p-4 sm:p-6 bg-white border border-emerald-100 rounded-2xl shadow-xs">
                        <p className="text-[10px] sm:text-xs font-bold text-emerald-500 uppercase tracking-wider mb-1">AI-Verified Resolved</p>
                        <p className="text-2xl sm:text-3xl font-black text-emerald-600">{resolvedCount}</p>
                    </div>
                </div>

                {/* My Reports Section */}
                <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">My Complaint Activity</h2>
                        <p className="text-[11px] sm:text-xs text-slate-400 font-medium">Real-time status updates and Before/After verification photos</p>
                    </div>

                    <div className="flex bg-white p-1 rounded-xl border border-slate-200 w-full sm:w-auto overflow-x-auto">
                        <button 
                            onClick={() => setFilter('all')}
                            className={`flex-1 sm:flex-initial px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${filter === 'all' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                            All ({complaints.length})
                        </button>
                        <button 
                            onClick={() => setFilter('pending')}
                            className={`flex-1 sm:flex-initial px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${filter === 'pending' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                            Active ({inProgressCount})
                        </button>
                        <button 
                            onClick={() => setFilter('resolved')}
                            className={`flex-1 sm:flex-initial px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${filter === 'resolved' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                            Resolved ({resolvedCount})
                        </button>
                    </div>
                </div>

                {/* Complaints Feed */}
                {loading ? (
                    <div className="py-20 text-center">
                        <div className="w-9 h-9 border-4 border-brand-blue border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Loading your civic records...</p>
                    </div>
                ) : filteredComplaints.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                        {filteredComplaints.map((c, idx) => (
                            <motion.div 
                                key={c._id}
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.04 }}
                                className="card-premium p-5 sm:p-6 bg-white border border-slate-100 rounded-3xl shadow-sm hover:shadow-lg transition-all flex flex-col justify-between"
                            >
                                <div>
                                    <div className="flex justify-between items-start mb-3">
                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black uppercase tracking-wider ${
                                            c.status === 'Resolved' 
                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                                : 'bg-blue-50 text-brand-blue border border-blue-200'
                                        }`}>
                                            {c.status}
                                        </span>
                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">
                                            {c.department || 'Assigned'}
                                        </span>
                                    </div>

                                    <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-3 line-clamp-2">
                                        {c.title}
                                    </h3>

                                    {/* Before/After Comparison or Evidence */}
                                    <div className="mb-3">
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
                                            <div className="h-40 sm:h-44 rounded-2xl overflow-hidden bg-slate-100 mb-2">
                                                <img src={c.imageUrl} alt="Complaint proof" className="w-full h-full object-cover" />
                                            </div>
                                        ) : null}

                                        <div className="flex items-center gap-1.5 text-slate-400 text-xs font-medium mt-2 truncate">
                                            <MapPin size={13} className="flex-shrink-0" />
                                            <span className="truncate">{c.location || 'Local territory'}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-[11px] text-slate-400 font-medium mt-2">
                                    <span>Category: <strong className="text-slate-700">{c.category}</strong></span>
                                    <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                ) : (
                    <div className="p-10 sm:p-16 text-center bg-white rounded-3xl border border-dashed border-slate-200">
                        <CheckCircle2 size={40} className="text-slate-300 mx-auto mb-2" />
                        <h3 className="text-base sm:text-lg font-bold text-slate-700">No complaints in this view</h3>
                        <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-5">
                            You have no {filter} reports at the moment.
                        </p>
                        <button 
                            onClick={() => navigate('/report')}
                            className="px-5 py-2.5 bg-brand-blue text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-md active:scale-95"
                        >
                            Submit a Report
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CitizenPage;
