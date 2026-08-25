import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { LogIn, User, Building2, Key, Mail, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

const Login = () => {
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { data } = await axios.post('http://localhost:5000/api/auth/login', formData);
            login(data);
            toast.success(`Welcome back, ${data.name}`);
            navigate('/home');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-slate-50 pt-20 pb-28 sm:py-24">
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="card-premium w-full max-w-md p-6 sm:p-10 bg-white rounded-3xl shadow-xl border border-slate-200/80">
                <div className="text-center mb-8">
                    <div className="w-12 h-12 bg-blue-50 text-brand-blue rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <LogIn size={22} />
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-1">Citizen Login</h2>
                    <p className="text-slate-500 font-medium text-xs sm:text-sm">Access your JanSetu grievance account</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
                    <div>
                        <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Email Address</label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input 
                                required 
                                type="email" 
                                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-medium focus:outline-none focus:border-brand-blue focus:bg-white transition-all placeholder:text-slate-400" 
                                placeholder="citizen@example.com"
                                value={formData.email} 
                                onChange={(e) => setFormData({...formData, email: e.target.value})}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Password</label>
                        <div className="relative">
                            <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input 
                                required 
                                type="password" 
                                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-medium focus:outline-none focus:border-brand-blue focus:bg-white transition-all placeholder:text-slate-400" 
                                placeholder="••••••••"
                                value={formData.password} 
                                onChange={(e) => setFormData({...formData, password: e.target.value})}
                            />
                        </div>
                    </div>

                    <button 
                        disabled={loading} 
                        className="w-full py-4 bg-brand-blue hover:bg-blue-600 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 mt-2"
                    >
                        {loading ? 'Processing...' : 'Sign In'} <ArrowRight size={16} />
                    </button>
                </form>

                <div className="mt-6 pt-6 border-t border-slate-100 text-center space-y-3">
                    <p className="text-slate-500 font-medium text-xs sm:text-sm">
                        New citizen? <Link to="/register" className="text-brand-blue font-bold hover:underline">Create account</Link>
                    </p>
                    <div className="flex justify-center items-center gap-3 text-[11px] text-slate-400 font-bold pt-1">
                        <Link to="/department/login" className="hover:text-amber-600 transition-colors">
                            🏢 Department Login
                        </Link>
                        <span>•</span>
                        <Link to="/admin/login" className="hover:text-slate-900 transition-colors">
                            🏛️ Admin Matrix
                        </Link>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default Login;
