import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { 
    Building2, 
    Lock, 
    Mail, 
    ArrowRight, 
    ShieldCheck, 
    Sparkles, 
    CheckCircle2, 
    Layers, 
    Zap, 
    Droplet, 
    Trash2, 
    Construction, 
    UserPlus
} from 'lucide-react';
import { motion } from 'framer-motion';

const DEPARTMENT_PRESETS = [
    { name: 'Sanitation', email: 'sanitation@jansetu.city', role: 'authority', icon: Trash2, color: 'bg-amber-500 text-white', label: 'Sanitation Division' },
    { name: 'Water Supply', email: 'water@jansetu.city', role: 'authority', icon: Droplet, color: 'bg-blue-600 text-white', label: 'Water Works Board' },
    { name: 'Public Works', email: 'roads@jansetu.city', role: 'authority', icon: Construction, color: 'bg-emerald-600 text-white', label: 'Roads & Infrastructure' },
    { name: 'Electric Board', email: 'electric@jansetu.city', role: 'authority', icon: Zap, color: 'bg-purple-600 text-white', label: 'Power & Grid Authority' },
];

const DepartmentLogin = () => {
    const [formData, setFormData] = useState({ email: 'sanitation@jansetu.city', password: 'adminPassword123' });
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        setLoading(true);
        const loginToast = toast.loading('Connecting to Department Operational Matrix...');

        try {
            const { data } = await axios.post('http://localhost:5000/api/auth/admin-login', formData);
            
            if (data.role !== 'authority' && data.role !== 'admin') {
                throw new Error('This gateway is exclusively for Department Officers & Authorities.');
            }

            login(data);
            toast.success(`Welcome, Officer ${data.name.split(' ')[0]} (${data.department || 'Officer'})`, { id: loginToast });
            navigate('/department');
        } catch (err) {
            try {
                const { data } = await axios.post('http://localhost:5000/api/auth/login', formData);
                if (data.role !== 'authority' && data.role !== 'admin') {
                    throw new Error('Access Denied: Only Department Authorities and Admins are permitted.');
                }
                login(data);
                toast.success(`Welcome, Officer ${data.name.split(' ')[0]} (${data.department || 'Authority'})`, { id: loginToast });
                navigate('/department');
            } catch (innerErr) {
                const errorMsg = innerErr.response?.data?.message || err.response?.data?.message || err.message || 'Authentication failed';
                toast.error(errorMsg, { id: loginToast });
            }
        } finally {
            setLoading(false);
        }
    };

    const handleQuickPreset = (preset) => {
        setFormData({
            email: preset.email,
            password: 'adminPassword123'
        });
        toast.success(`Selected ${preset.label}`);
    };

    return (
        <div className="min-h-screen pt-20 sm:pt-28 pb-28 sm:pb-20 bg-slate-50 text-slate-900 flex items-center justify-center relative overflow-hidden">
            {/* Ambient Lighting Gradients */}
            <div className="absolute top-1/3 left-1/4 w-[400px] sm:w-[600px] h-[400px] sm:h-[600px] bg-blue-500/5 rounded-full blur-[150px] pointer-events-none"></div>
            <div className="absolute bottom-1/4 right-1/4 w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-amber-500/5 rounded-full blur-[150px] pointer-events-none"></div>

            <div className="container mx-auto px-4 sm:px-6 relative z-10 max-w-xl">
                {/* Header Badge */}
                <div className="text-center mb-6 sm:mb-8">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-[10px] sm:text-[11px] font-black text-amber-700 uppercase tracking-wider mb-3 shadow-xs">
                        <Building2 size={13} className="text-amber-600" /> Municipal Department Officers
                    </div>
                    <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-slate-900 mb-1 sm:mb-2">
                        Department <span className="text-amber-600">Command Portal</span>
                    </h1>
                    <p className="text-slate-500 text-xs sm:text-sm font-medium max-w-md mx-auto">
                        Official workplace for municipal line departments, grievance resolution officers, and field engineers.
                    </p>
                </div>

                {/* 1-Click Quick Department Selectors */}
                <div className="mb-5 sm:mb-6">
                    <p className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                        <Sparkles size={13} className="text-amber-600" /> 1-Click Quick Fill Demo Departments:
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
                        {DEPARTMENT_PRESETS.map((preset) => {
                            const IconComponent = preset.icon;
                            const isSelected = formData.email === preset.email;
                            return (
                                <button
                                    key={preset.name}
                                    type="button"
                                    onClick={() => handleQuickPreset(preset)}
                                    className={`p-2.5 sm:p-3 rounded-2xl border text-left transition-all relative overflow-hidden group ${
                                        isSelected 
                                            ? 'bg-amber-50/70 border-amber-400 shadow-xs ring-2 ring-amber-300' 
                                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 shadow-xs'
                                    }`}
                                >
                                    <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl ${preset.color} flex items-center justify-center mb-1.5 shadow-xs`}>
                                        <IconComponent size={14} />
                                    </div>
                                    <p className="text-xs font-bold text-slate-900 truncate">{preset.name}</p>
                                    <p className="text-[8px] sm:text-[9px] text-slate-400 truncate">{preset.email.split('@')[0]}</p>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Main Login Card */}
                <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-6 sm:p-10 bg-white border border-slate-200/90 rounded-3xl shadow-xl shadow-slate-200/50"
                >
                    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">
                                Official Department Email
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input 
                                    type="email"
                                    required
                                    placeholder="officer@jansetu.city"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-medium text-slate-900 placeholder-slate-400 outline-none focus:border-amber-500 focus:bg-white transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">
                                Officer Security Key
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input 
                                    type="password"
                                    required
                                    placeholder="••••••••••••"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-medium text-slate-900 placeholder-slate-400 outline-none focus:border-amber-500 focus:bg-white transition-all"
                                />
                            </div>
                        </div>

                        <button 
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 active:scale-95 transition-all mt-4"
                        >
                            {loading ? 'Authenticating Access...' : 'Enter Department Dashboard'} <ArrowRight size={16} />
                        </button>
                    </form>

                    {/* Navigation Switchers */}
                    <div className="mt-6 pt-6 border-t border-slate-100 space-y-2.5 text-center">
                        <p className="text-xs text-slate-500 font-medium">
                            New Department Officer or Field Engineer?{' '}
                            <Link to="/department/register" className="text-amber-600 font-bold hover:underline inline-flex items-center gap-1">
                                Register Account <UserPlus size={13} />
                            </Link>
                        </p>
                        <div className="flex justify-center items-center gap-3 text-[11px] text-slate-400 pt-1 font-bold">
                            <Link to="/admin/login" className="hover:text-slate-700 transition-colors">
                                🏛️ Super Admin
                            </Link>
                            <span>•</span>
                            <Link to="/login" className="hover:text-brand-blue transition-colors">
                                👤 Citizen Login
                            </Link>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default DepartmentLogin;
