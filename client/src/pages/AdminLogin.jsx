import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { 
    ShieldCheck, 
    Lock, 
    Mail, 
    ArrowRight, 
    Activity, 
    Building2, 
    KeyRound, 
    ShieldAlert,
    CheckCircle2
} from 'lucide-react';
import { motion } from 'framer-motion';

const AdminLogin = () => {
    const [formData, setFormData] = useState({ email: 'admin@jansetu.city', password: 'adminPassword123' });
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const loginToast = toast.loading('Authenticating Administrative Access...');

        try {
            const { data } = await axios.post('http://localhost:5000/api/auth/admin-login', formData);
            login(data);
            toast.success(`Welcome, Commissioner ${data.name.split(' ')[0]}`, { id: loginToast });
            navigate('/admin');
        } catch (err) {
            const errorMsg = err.response?.data?.message || 'Invalid administrative credentials';
            toast.error(errorMsg, { id: loginToast });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen pt-20 sm:pt-28 pb-28 sm:pb-20 bg-slate-50 text-slate-900 flex items-center justify-center relative overflow-hidden">
            {/* Ambient Background Accents */}
            <div className="absolute top-1/4 left-1/4 w-[400px] sm:w-[500px] h-[400px] sm:h-[500px] bg-blue-500/5 rounded-full blur-[140px] pointer-events-none"></div>
            <div className="absolute bottom-1/4 right-1/4 w-[400px] sm:w-[500px] h-[400px] sm:h-[500px] bg-amber-500/5 rounded-full blur-[140px] pointer-events-none"></div>

            <div className="container mx-auto px-4 sm:px-6 relative z-10 max-w-md">
                {/* Security Tag */}
                <div className="text-center mb-6 sm:mb-8">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-200 rounded-full text-[10px] sm:text-[11px] font-black text-brand-blue uppercase tracking-wider mb-3 shadow-xs">
                        <Activity size={13} className="text-brand-blue animate-pulse" /> City Executive Gateway
                    </div>
                    <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-slate-900 mb-1.5">
                        Admin <span className="text-brand-blue">Command Matrix</span>
                    </h1>
                    <p className="text-slate-500 text-xs sm:text-sm font-medium">
                        City Administration, Commissioner & Inter-Departmental Oversight
                    </p>
                </div>

                {/* Login Card */}
                <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-6 sm:p-10 bg-white border border-slate-200/90 rounded-3xl shadow-xl shadow-slate-200/50"
                >
                    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">
                                Official Commissioner Email
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input 
                                    type="email"
                                    required
                                    placeholder="admin@jansetu.city"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-medium text-slate-900 placeholder-slate-400 outline-none focus:border-brand-blue focus:bg-white transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">
                                Security Passkey
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input 
                                    type="password"
                                    required
                                    placeholder="••••••••••••"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-medium text-slate-900 placeholder-slate-400 outline-none focus:border-brand-blue focus:bg-white transition-all"
                                />
                            </div>
                        </div>

                        <button 
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-slate-900/10 flex items-center justify-center gap-2 active:scale-95 transition-all mt-4"
                        >
                            {loading ? 'Authenticating Access...' : 'Authenticate Matrix Access'} <ArrowRight size={16} />
                        </button>
                    </form>

                    {/* Notice */}
                    <div className="mt-6 pt-6 border-t border-slate-100 space-y-2.5 text-center">
                        <p className="text-xs text-slate-500 font-medium">
                            Municipal Line Department Officer?{' '}
                            <Link to="/department/login" className="text-amber-600 font-bold hover:underline">
                                Department Login
                            </Link>
                        </p>
                        <div className="flex justify-center items-center gap-3 text-[11px] text-slate-400 pt-1 font-bold">
                            <Link to="/department/register" className="hover:text-amber-600 transition-colors">
                                🏢 Register Department
                            </Link>
                            <span>•</span>
                            <Link to="/login" className="hover:text-brand-blue transition-colors">
                                👤 Citizen Portal
                            </Link>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default AdminLogin;
