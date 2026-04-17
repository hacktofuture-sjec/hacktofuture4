import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import HotspotMap from '../components/HotspotMap';
import toast from 'react-hot-toast';
import { 
    Clock, 
    LayoutDashboard,
    TrendingUp,
    Filter,
    ArrowRightCircle,
    CheckCircle,
    User,
    Building2,
    MapPin,
    Trophy,
    AlertCircle,
    ChevronUp,
    ChevronDown,
    Flame
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const StatusBadge = ({ status }) => {
    const styles = {
        'Pending': 'bg-slate-100 text-slate-500',
        'Assigned': 'bg-blue-50 text-brand-blue border-blue-100',
        'In Progress': 'bg-orange-50 text-brand-orange border-orange-100',
        'Resolved': 'bg-green-50 text-emerald-600 border-green-200'
    };
    return (
        <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border ${styles[status]}`}>
            {status}
        </span>
    );
};

const ComplaintCard = ({ c, isAuthority = false, onUpdateStatus, index }) => {
    const [selectedStatus, setSelectedStatus] = useState(c.status);

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="card-premium p-8 group flex flex-col h-full bg-white shadow-lg hover:shadow-xl transition-all"
        >
            <div className="flex justify-between items-start mb-6">
                <StatusBadge status={c.status} />
                <div className={`px-3 py-1 rounded-lg text-[10px] font-black border uppercase tracking-widest ${c.priority === 'High' ? 'text-red-500 border-red-100 bg-red-50' : 'text-slate-400 bg-slate-50 border-slate-100'}`}>
                    {c.priority} Priority
                </div>
            </div>

            <div className="flex-1 mb-8">
                <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-brand-blue transition-colors leading-tight">
                    {c.title}
                </h3>
                {c.imageUrl && (
                    <div className="w-full h-40 rounded-2xl mb-4 overflow-hidden shadow-inner bg-slate-100">
                        <img src={c.imageUrl} alt="Evidence" className="w-full h-full object-cover" />
                    </div>
                )}
                <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-widest whitespace-nowrap overflow-hidden text-ellipsis">
                    <MapPin size={14} className="flex-shrink-0" /> {c.location || 'Local Territory'}
                </div>
            </div>

            <div className="pt-6 border-t border-slate-50 mt-auto">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none">Category</p>
                        <p className="text-sm font-bold text-slate-700">{c.category}</p>
                    </div>
                    {isAuthority && c.deadline && (
                        <div className="text-right">
                            <p className="text-[10px] font-black text-red-400 uppercase tracking-widest leading-none flex items-center gap-1 justify-end">
                                <Clock size={10} /> Deadline
                            </p>
                            <p className="text-xs font-bold text-slate-700">{new Date(c.deadline).toLocaleString()}</p>
                        </div>
                    )}
                </div>

                {isAuthority && c.status !== 'Resolved' && (
                    <div className="flex gap-2">
                        <select 
                            value={selectedStatus} 
                            onChange={(e) => setSelectedStatus(e.target.value)}
                            className="flex-1 p-3 bg-slate-50 border-none rounded-xl text-xs font-bold outline-none ring-1 ring-slate-200 focus:ring-brand-blue"
                        >
                            <option value="Assigned">Assigned</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Resolved">Resolved</option>
                        </select>
                        <button 
                            onClick={() => onUpdateStatus(c._id, selectedStatus)}
                            className="p-3 bg-brand-blue text-white rounded-xl hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20"
                        >
                            <CheckCircle size={18} />
                        </button>
                    </div>
                )}
            </div>
        </motion.div>
    );
};

const ClusterTrend = ({ clusterId, complaints, isAuthority, onUpdateStatus }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="card-premium border-2 border-slate-100 mb-8 overflow-hidden bg-white">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-8 hover:bg-slate-50 transition-all font-bold"
            >
                <div className="flex items-center gap-6">
                    <div className="w-14 h-14 bg-orange-100 text-brand-orange rounded-2xl flex items-center justify-center">
                        <Flame size={28} className="animate-pulse" />
                    </div>
                    <div className="text-left">
                        <h3 className="text-xl font-black text-slate-900 leading-tight">Civic Hotspot Trend #{clusterId}</h3>
                        <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">{complaints.length} recurring reports identified</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                     <span className="px-4 py-1.5 bg-brand-orange/10 text-brand-orange text-[10px] font-black rounded-full uppercase tracking-widest">K-Means Grouped</span>
                    {isOpen ? <ChevronUp /> : <ChevronDown />}
                </div>
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div 
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="p-8 bg-slate-50/50 border-t border-slate-100"
                    >
                        <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-8">
                            {complaints.map((c, i) => (
                                <ComplaintCard key={c._id} c={c} isAuthority={isAuthority} onUpdateStatus={onUpdateStatus} index={i} />
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export const CitizenDashboard = () => {
    const [complaints, setComplaints] = useState([]);
    const { user } = useAuth();

    useEffect(() => {
        const fetch = async () => {
            const { data } = await axios.get('http://localhost:5000/api/complaints/my', {
                headers: { Authorization: `Bearer ${user.token}` }
            });
            setComplaints(data.data);
        };
        fetch();
    }, [user.token]);

    return (
        <div className="min-h-screen pt-40 pb-20 bg-slate-50">
            <div className="container mx-auto px-6">
                <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 mb-20">
                    <div>
                        <div className="flex items-center gap-2 text-brand-blue font-black uppercase text-xs tracking-[0.2em] mb-4">
                            <Trophy size={14} /> Rewards Active
                        </div>
                        <h1 className="text-5xl font-black text-slate-900 tracking-tighter">My <span className="text-brand-blue">Civic Reports.</span></h1>
                    </div>
                    <div className="flex gap-4">
                        <div className="card-premium px-8 py-4 flex flex-col items-center min-w-[140px] bg-white">
                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Total</p>
                            <p className="text-4xl font-black text-slate-900">{complaints.length}</p>
                        </div>
                        <div className="card-premium px-8 py-4 flex flex-col items-center min-w-[140px] border-orange-100 bg-white shadow-xl shadow-brand-orange/10">
                             <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Points</p>
                             <p className="text-4xl font-black text-brand-orange">{user.rewardPoints}</p>
                        </div>
                    </div>
                </header>

                <div className="grid lg:grid-cols-3 gap-8">
                    {complaints.map((c, i) => <ComplaintCard key={c._id} c={c} index={i} />)}
                </div>
            </div>
        </div>
    );
};

export const AuthorityDashboard = () => {
    const [complaints, setComplaints] = useState([]);
    const [expandedEscalation, setExpandedEscalation] = useState(false);
    const [viewMode, setViewMode] = useState('list'); // 'list' or 'trend'
    const [userLoc, setUserLoc] = useState(null);
    const { user } = useAuth();

    const fetchData = async () => {
        try {
            const { data } = await axios.get('http://localhost:5000/api/complaints/department', {
                headers: { Authorization: `Bearer ${user.token}` }
            });
            setComplaints(data.data);
        } catch (err) { toast.error('Department Feed Failure'); }
    };

    useEffect(() => { 
        fetchData(); 
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setUserLoc([pos.coords.latitude, pos.coords.longitude]),
                () => console.log('Location denied')
            );
        }
    }, [user.token]);

    const handleUpdateStatus = async (id, status) => {
        try {
            await axios.patch(`http://localhost:5000/api/complaints/${id}/status`, { status }, {
                headers: { Authorization: `Bearer ${user.token}` }
            });
            toast.success(`Protocol ${status} Handled.`);
            fetchData();
        } catch (err) { toast.error('Sync Failure'); }
    };

    const overdueComplaints = complaints.filter(c => c.deadline && new Date(c.deadline) < new Date() && c.status !== 'Resolved');

    // Grouping by ClusterId
    const clusters = complaints.reduce((acc, c) => {
        if (!c.clusterId && c.clusterId !== 0) return acc;
        if (!acc[c.clusterId]) acc[c.clusterId] = [];
        acc[c.clusterId].push(c);
        return acc;
    }, {});

    return (
        <div className="min-h-screen pt-40 pb-20 bg-slate-50">
            <div className="container mx-auto px-6">
                <header className="mb-16">
                    <div className="flex items-center gap-2 text-brand-orange font-black uppercase text-xs tracking-[0.2em] mb-4">
                        <Building2 size={14} /> Departmental Sector Logs
                    </div>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
                         <div>
                            <h1 className="text-5xl font-black text-slate-900 tracking-tighter mb-4 italic">
                                {user.department} <span className="text-brand-orange">Division.</span>
                            </h1>
                            <div className="flex gap-4 mb-4">
                                <button 
                                    onClick={() => setViewMode('list')}
                                    className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'list' ? 'bg-brand-blue text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}
                                >
                                    Work Order Feed
                                </button>
                                <button 
                                    onClick={() => setViewMode('trend')}
                                    className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'trend' ? 'bg-orange-500 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}
                                >
                                    Hotspot Trends
                                </button>
                            </div>
                         </div>
                         <div className="flex gap-4">
                             <div className="card-premium px-8 py-4 bg-white min-w-[140px]">
                                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1 text-center">In-Queue</p>
                                <p className="text-4xl font-black text-slate-900 text-center">{complaints.length}</p>
                             </div>
                         </div>
                    </div>
                </header>

                <HotspotMap complaints={complaints} userLocation={userLoc} />

                <div className="mt-16">
                {/* EMERGENCY DRAWER */}
                <AnimatePresence>
                    {overdueComplaints.length > 0 && (
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mb-12">
                            <div className="card-premium bg-white border-red-100 overflow-hidden shadow-2xl shadow-red-500/10">
                                <button onClick={() => setExpandedEscalation(!expandedEscalation)} className="w-full flex items-center justify-between p-6 bg-red-50/50 hover:bg-red-50 transition-all">
                                    <div className="flex items-center gap-6">
                                        <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center text-white"><AlertCircle size={24} className="animate-pulse" /></div>
                                        <div className="text-left">
                                            <h2 className="text-lg font-black text-slate-900 leading-none mb-1">SLA Breach Detected</h2>
                                            <p className="text-xs font-bold text-red-500 uppercase tracking-widest">{overdueComplaints.length} overdue reports</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white px-3 py-1 rounded-full border border-slate-100 shadow-sm font-bold">Priority View</span>
                                        {expandedEscalation ? <ChevronUp className="text-slate-400" /> : <ChevronDown className="text-slate-400" />}
                                    </div>
                                </button>
                                <AnimatePresence>
                                    {expandedEscalation && (
                                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-red-50 p-8 bg-red-50/20">
                                            <div className="grid lg:grid-cols-3 gap-8">
                                                {overdueComplaints.map((c, i) => (
                                                    <ComplaintCard key={`overdue-${c._id}`} c={c} isAuthority={true} onUpdateStatus={handleUpdateStatus} index={i} />
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {viewMode === 'list' ? (
                <div className="grid lg:grid-cols-3 gap-8">
                    {complaints.length > 0 ? (
                        complaints.map((c, i) => (
                            <ComplaintCard key={c._id} c={c} isAuthority={true} onUpdateStatus={handleUpdateStatus} index={i} />
                        ))
                    ) : (
                        <div className="lg:col-span-3 py-32 text-center card-premium bg-slate-50 border-dashed border-2 border-slate-200">
                            <Clock className="mx-auto text-slate-200 mb-6" size={60} />
                            <h3 className="text-xl font-black text-slate-400 uppercase tracking-tighter">Operational Peace</h3>
                            <p className="text-slate-400 font-medium">All department protocols are currently up to date.</p>
                        </div>
                    )}
                </div>
                ) : (
                <div className="space-y-4">
                    {Object.keys(clusters).filter(cid => clusters[cid].length > 1).length > 0 ? (
                        Object.keys(clusters).filter(cid => clusters[cid].length > 1).map((cid) => (
                            <ClusterTrend 
                                key={cid} 
                                clusterId={cid} 
                                complaints={clusters[cid]} 
                                isAuthority={true} 
                                onUpdateStatus={handleUpdateStatus} 
                            />
                        ))
                    ) : (
                        <div className="text-center py-20">
                            <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">No recurring trends identified yet</p>
                        </div>
                    )}
                </div>
                )}
                </div>
            </div>
        </div>
    );
};
