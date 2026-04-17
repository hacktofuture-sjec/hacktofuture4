import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { UserPlus, User, Building2, Mail, Key } from 'lucide-react';
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
        <div className="min-h-screen py-24 flex items-center justify-center p-6 bg-slate-50">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="card-premium w-full max-w-2xl p-12">
                <div className="text-center mb-12">
                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">Create Account.</h2>
                    <p className="text-slate-500 font-medium">Join our civic network</p>
                </div>

                {/* Role Switcher */}
                <div className="flex p-1.5 bg-slate-100 rounded-2xl mb-12">
                    <button 
                        onClick={() => setRole('citizen')}
                        className={`flex-1 py-4 px-6 rounded-xl font-bold flex items-center justify-center gap-3 transition-all ${role === 'citizen' ? 'bg-white shadow-lg text-brand-blue' : 'text-slate-500'}`}
                    >
                        <User size={20} /> Citizen
                    </button>
                    <button 
                        onClick={() => setRole('authority')}
                        className={`flex-1 py-4 px-6 rounded-xl font-bold flex items-center justify-center gap-3 transition-all ${role === 'authority' ? 'bg-white shadow-lg text-brand-orange' : 'text-slate-500'}`}
                    >
                        <Building2 size={20} /> Authority
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">{role === 'citizen' ? 'Full Name' : 'Authority User Name'}</label>
                            <input 
                                required className="input-field" placeholder="John Doe"
                                value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Email Address</label>
                            <input 
                                required type="email" className="input-field" placeholder="name@email.com"
                                value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})}
                            />
                        </div>
                    </div>

                    <div className={role === 'citizen' ? '' : 'grid md:grid-cols-2 gap-6'}>
                         <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Secure Password</label>
                            <input 
                                required type="password" className="input-field" placeholder="••••••••"
                                value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})}
                            />
                        </div>
                        
                        <AnimatePresence>
                            {role === 'authority' && (
                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Department</label>
                                    <select 
                                        required className="input-field appearance-none"
                                        value={formData.department} onChange={(e) => setFormData({...formData, department: e.target.value})}
                                    >
                                        <option value="">Select Dept</option>
                                        {depts.map(d => <option key={d}>{d}</option>)}
                                    </select>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <button disabled={loading} className={`w-full py-5 text-lg ${role === 'citizen' ? 'btn-blue' : 'btn-orange'}`}>
                        {loading ? 'Processing...' : 'Create Account'}
                    </button>
                </form>

                <div className="mt-10 text-center text-slate-500 font-medium">
                    Already registered? <Link to="/login" className="text-brand-blue font-black hover:underline">Log in</Link>
                </div>
            </motion.div>
        </div>
    );
};

export default Register;
