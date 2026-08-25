import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { UserPlus, User, Building2, Mail, Key, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Register = () => {
    const [role, setRole] = useState('citizen');
    const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'citizen', department: '' });
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const sendData = { ...formData, role };
            const { data } = await axios.post('http://localhost:5000/api/auth/register', sendData);
            login(data);
            toast.success(`Welcome to JanSetu, ${data.name}!`);
            navigate('/home');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    const depts = ['Sanitation', 'Water Supply', 'Electric Board', 'Public Works', 'Police'];

    return (
        <div className="min-h-screen pt-20 sm:pt-28 pb-28 sm:pb-24 flex items-center justify-center p-4 sm:p-6 bg-slate-50">
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="card-premium w-full max-w-xl p-6 sm:p-10 bg-white rounded-3xl shadow-xl border border-slate-200/80">
                <div className="text-center mb-6 sm:mb-8">
                    <div className="w-12 h-12 bg-blue-50 text-brand-blue rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <UserPlus size={22} />
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-1">Create Account</h2>
                    <p className="text-slate-500 font-medium text-xs sm:text-sm">Join the JanSetu civic network</p>
                </div>

                {/* Role Switcher */}
                <div className="flex p-1 bg-slate-100 rounded-2xl mb-6 sm:mb-8">
                    <button 
                        type="button"
                        onClick={() => setRole('citizen')}
                        className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${role === 'citizen' ? 'bg-white shadow text-brand-blue' : 'text-slate-500'}`}
                    >
                        <User size={16} /> Citizen
                    </button>
                    <button 
                        type="button"
                        onClick={() => setRole('authority')}
                        className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${role === 'authority' ? 'bg-white shadow text-brand-orange' : 'text-slate-500'}`}
                    >
                        <Building2 size={16} /> Authority
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">{role === 'citizen' ? 'Full Name' : 'Officer Name'}</label>
                            <input 
                                required 
                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-medium focus:outline-none focus:border-brand-blue focus:bg-white transition-all placeholder:text-slate-400" 
                                placeholder="John Doe"
                                value={formData.name} 
                                onChange={(e) => setFormData({...formData, name: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Email Address</label>
                            <input 
                                required 
                                type="email" 
                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-medium focus:outline-none focus:border-brand-blue focus:bg-white transition-all placeholder:text-slate-400" 
                                placeholder="name@email.com"
                                value={formData.email} 
                                onChange={(e) => setFormData({...formData, email: e.target.value})}
                            />
                        </div>
                    </div>

                    <div className={role === 'citizen' ? '' : 'grid grid-cols-1 sm:grid-cols-2 gap-4'}>
                         <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Password</label>
                            <input 
                                required 
                                type="password" 
                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-medium focus:outline-none focus:border-brand-blue focus:bg-white transition-all placeholder:text-slate-400" 
                                placeholder="••••••••"
                                value={formData.password} 
                                onChange={(e) => setFormData({...formData, password: e.target.value})}
                            />
                        </div>
                        
                        <AnimatePresence>
                            {role === 'authority' && (
                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                                    <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Department</label>
                                    <select 
                                        required 
                                        className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-medium focus:outline-none focus:border-brand-orange focus:bg-white transition-all text-slate-800"
                                        value={formData.department} 
                                        onChange={(e) => setFormData({...formData, department: e.target.value})}
                                    >
                                        <option value="">Select Dept</option>
                                        {depts.map(d => <option key={d}>{d}</option>)}
                                    </select>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <button 
                        disabled={loading} 
                        className={`w-full py-4 text-xs font-black uppercase tracking-wider rounded-2xl shadow-lg active:scale-95 transition-all text-white mt-2 flex items-center justify-center gap-2 ${
                            role === 'citizen' 
                                ? 'bg-brand-blue hover:bg-blue-600 shadow-blue-500/20' 
                                : 'bg-brand-orange hover:bg-orange-600 shadow-orange-500/20'
                        }`}
                    >
                        {loading ? 'Creating...' : 'Register Account'} <ArrowRight size={16} />
                    </button>
                </form>

                <div className="mt-6 pt-4 border-t border-slate-100 text-center text-slate-500 font-medium text-xs sm:text-sm">
                    Already registered? <Link to="/login" className="text-brand-blue font-bold hover:underline">Log in</Link>
                </div>
            </motion.div>
        </div>
    );
};

export default Register;
