import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { LogIn, User, Building2, Key, Mail } from 'lucide-react';
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
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card-premium w-full max-w-lg p-12">
                <div className="text-center mb-12">
                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">Welcome Back.</h2>
                    <p className="text-slate-500 font-medium">Access your JanSetu account</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Email Address</label>
                        <div className="relative">
                            <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                            <input 
                                required type="email" className="input-field pl-14" placeholder="name@email.com"
                                value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Password</label>
                        <div className="relative">
                            <Key className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                            <input 
                                required type="password" className="input-field pl-14" placeholder="••••••••"
                                value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})}
                            />
                        </div>
                    </div>

                    <button disabled={loading} className="btn-blue w-full py-5 text-lg">
                        {loading ? 'Processing...' : 'Login'}
                    </button>
                </form>

                <div className="mt-10 text-center text-slate-500 font-medium">
                    New to JanSetu? <Link to="/register" className="text-brand-blue font-black hover:underline">Create account</Link>
                </div>
            </motion.div>
        </div>
    );
};

export default Login;
