import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, Trophy, LogIn, UserPlus } from 'lucide-react';

const Navbar = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <nav className="nav-blur">
            <div className="container mx-auto px-6 h-20 flex justify-between items-center">
                <Link to="/" className="flex items-center gap-3 group">
                    <img 
                        src="/JanSetuLogo.jpeg" 
                        alt="JanSetu Logo" 
                        className="w-12 h-12 object-contain rounded-xl shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform"
                    />
                    <span className="font-black text-2xl tracking-tighter text-slate-900">
                        Jan<span className="text-brand-orange">Setu</span>
                    </span>
                </Link>

                <div className="flex items-center gap-6">
                    {user ? (
                        <>
                            {user.role === 'citizen' ? (
                                <>
                                    <Link to="/dashboard" className="nav-link font-bold">Dashboard</Link>
                                    <Link to="/report" className="nav-link font-bold">Raise Report</Link>
                                    <Link to="/rewards" className="flex items-center gap-2 px-4 py-2 bg-orange-50 text-brand-orange rounded-xl font-bold border border-orange-100 hover:bg-orange-100 transition-colors">
                                        <Trophy size={18} /> {user.rewardPoints} Pts
                                    </Link>
                                </>
                            ) : (
                                <>
                                    <Link to="/home" className="nav-link font-bold">Home</Link>
                                    <Link to="/department" className="nav-link font-bold">Workforce Hub</Link>
                                    <Link to="/executive" className="nav-link font-bold">Executive Insight</Link>
                                </>
                            )}
                            <div className="h-6 w-px bg-slate-200 mx-2"></div>
                            <button 
                                onClick={handleLogout}
                                className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                            >
                                <LogOut size={20} />
                            </button>
                        </>
                    ) : (
                        <div className="flex items-center gap-4">
                            <Link to="/login" className="flex items-center gap-2 px-5 py-2.5 text-slate-700 font-bold hover:text-brand-blue transition-colors">
                                <LogIn size={18} /> Login
                            </Link>
                            <Link to="/register" className="flex items-center gap-2 px-6 py-2.5 bg-brand-blue text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-600 transition-all">
                                <UserPlus size={18} /> Join JanSetu
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
