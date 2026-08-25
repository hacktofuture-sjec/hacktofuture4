import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
    LogOut, 
    Trophy, 
    LogIn, 
    UserPlus, 
    Menu, 
    X, 
    Building2, 
    ShieldCheck, 
    Home as HomeIcon, 
    PlusCircle, 
    LayoutDashboard,
    Layers,
    User,
    Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import VoiceCallButton from './VoiceCallButton';


const Navbar = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const handleLogout = () => {
        logout();
        setIsMobileMenuOpen(false);
        navigate('/');
    };

    const isActive = (path) => location.pathname === path;

    return (
        <>
            {/* Top Desktop & Mobile Navigation Header */}
            <nav className="nav-blur relative z-[100] border-b border-slate-200/80">
                <div className="container mx-auto px-4 sm:px-6 h-16 sm:h-20 flex justify-between items-center">
                    {/* Brand Logo */}
                    <Link 
                        to="/" 
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex items-center gap-2.5 sm:gap-3 group flex-shrink-0"
                    >
                        <img 
                            src="/JanSetuLogo.jpeg" 
                            alt="JanSetu Logo" 
                            className="w-10 h-10 sm:w-12 sm:h-12 object-contain rounded-xl shadow-md group-hover:scale-105 transition-transform"
                        />
                        <span className="font-black text-xl sm:text-2xl tracking-tighter text-slate-900">
                            Jan<span className="text-brand-orange">Setu</span>
                        </span>
                    </Link>

                    {/* Desktop Navigation Links */}
                    <div className="hidden md:flex items-center gap-4 lg:gap-6">
                        {user ? (
                            <>
                                {user.role === 'citizen' ? (
                                    <>
                                        <Link 
                                            to="/citizen" 
                                            className={`nav-link font-bold px-3 py-2 rounded-xl transition-all ${isActive('/citizen') ? 'text-brand-blue bg-blue-50/80' : ''}`}
                                        >
                                            My Portal
                                        </Link>
                                        <Link 
                                            to="/report" 
                                            className={`nav-link font-bold px-3 py-2 rounded-xl transition-all ${isActive('/report') ? 'text-brand-blue bg-blue-50/80' : ''}`}
                                        >
                                            Raise Report
                                        </Link>
                                        <VoiceCallButton isFloating={false} />
                                        <Link 
                                            to="/rewards" 
                                            className={`flex items-center gap-2 px-3.5 py-1.5 bg-orange-50 text-brand-orange rounded-xl font-bold border border-orange-200 hover:bg-orange-100 transition-colors text-xs ${isActive('/rewards') ? 'ring-2 ring-brand-orange/30' : ''}`}
                                        >
                                            <Trophy size={16} /> {user.rewardPoints || 0} Pts
                                        </Link>
                                    </>
                                ) : user.role === 'admin' ? (
                                    <>
                                        <Link 
                                            to="/admin" 
                                            className={`nav-link font-bold px-3 py-2 rounded-xl transition-all ${isActive('/admin') ? 'text-brand-blue bg-blue-50/80' : ''}`}
                                        >
                                            Admin Portal
                                        </Link>
                                        <Link 
                                            to="/department" 
                                            className={`nav-link font-bold px-3 py-2 rounded-xl transition-all ${isActive('/department') ? 'text-brand-blue bg-blue-50/80' : ''}`}
                                        >
                                            Department Feed
                                        </Link>
                                        <VoiceCallButton isFloating={false} />
                                    </>
                                ) : (
                                    <>
                                        <Link 
                                            to="/department" 
                                            className={`nav-link font-bold px-3 py-2 rounded-xl transition-all ${isActive('/department') ? 'text-brand-blue bg-blue-50/80' : ''}`}
                                        >
                                            Department Feed
                                        </Link>
                                        <Link 
                                            to="/home" 
                                            className={`nav-link font-bold px-3 py-2 rounded-xl transition-all ${isActive('/home') ? 'text-brand-blue bg-blue-50/80' : ''}`}
                                        >
                                            Overview
                                        </Link>
                                        <VoiceCallButton isFloating={false} />
                                    </>
                                )}

                                <div className="h-6 w-px bg-slate-200 mx-1"></div>

                                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                    <span className="truncate max-w-[120px]">{user.name?.split(' ')[0]}</span>
                                </div>

                                <button 
                                    onClick={handleLogout}
                                    className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                    title="Sign Out"
                                >
                                    <LogOut size={18} />
                                </button>
                            </>
                        ) : (
                            <div className="flex items-center gap-2 lg:gap-3">
                                <VoiceCallButton isFloating={false} />
                                <Link 
                                    to="/login" 
                                    className="flex items-center gap-1.5 px-3 py-2 text-xs text-slate-700 font-bold hover:text-brand-blue transition-colors"
                                >
                                    <LogIn size={15} /> Citizen Login
                                </Link>
                                <Link 
                                    to="/department/login" 
                                    className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500/10 text-amber-700 border border-amber-500/30 rounded-xl text-xs font-bold hover:bg-amber-500/20 shadow-sm transition-all"
                                >
                                    🏢 Department Portal
                                </Link>
                                <Link 
                                    to="/admin/login" 
                                    className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 shadow transition-all"
                                >
                                    🏛️ Super Admin
                                </Link>
                                <Link 
                                    to="/register" 
                                    className="flex items-center gap-1.5 px-4 py-2 bg-brand-blue text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-600 transition-all"
                                >
                                    <UserPlus size={15} /> Sign Up
                                </Link>
                            </div>
                        )}

                    </div>

                    {/* Mobile Hamburger Toggle Button */}
                    <div className="flex items-center gap-2 md:hidden">
                        {user && user.role === 'citizen' && (
                            <Link 
                                to="/rewards"
                                className="flex items-center gap-1 px-2.5 py-1 bg-orange-50 text-brand-orange rounded-lg font-bold border border-orange-200 text-xs"
                            >
                                <Trophy size={14} /> {user.rewardPoints || 0}
                            </Link>
                        )}
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="p-2.5 text-slate-700 hover:bg-slate-100 rounded-xl transition-colors active:scale-95"
                            aria-label="Toggle navigation menu"
                        >
                            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                    </div>
                </div>

                {/* Mobile Drawer Menu (Slides Down on Small Screens) */}
                <AnimatePresence>
                    {isMobileMenuOpen && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="md:hidden border-t border-slate-100 bg-white/95 backdrop-blur-2xl px-6 py-6 shadow-2xl overflow-hidden"
                        >
                            <div className="space-y-4">
                                {user ? (
                                    <>
                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                                            <div>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Signed in as</p>
                                                <p className="text-sm font-black text-slate-900">{user.name}</p>
                                                <p className="text-xs text-brand-blue font-bold uppercase">{user.role} {user.department ? `• ${user.department}` : ''}</p>
                                            </div>
                                            {user.role === 'citizen' && (
                                                <div className="px-3 py-1.5 bg-orange-100 text-brand-orange rounded-xl text-xs font-black flex items-center gap-1">
                                                    <Trophy size={14} /> {user.rewardPoints || 0} Pts
                                                </div>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 gap-2 pt-2">
                                            {user.role === 'citizen' ? (
                                                <>
                                                    <Link
                                                        to="/citizen"
                                                        onClick={() => setIsMobileMenuOpen(false)}
                                                        className={`p-3.5 rounded-xl font-bold text-sm flex items-center gap-3 ${isActive('/citizen') ? 'bg-brand-blue text-white' : 'text-slate-700 bg-slate-50'}`}
                                                    >
                                                        <LayoutDashboard size={18} /> My Citizen Portal
                                                    </Link>
                                                    <Link
                                                        to="/report"
                                                        onClick={() => setIsMobileMenuOpen(false)}
                                                        className={`p-3.5 rounded-xl font-bold text-sm flex items-center gap-3 ${isActive('/report') ? 'bg-brand-blue text-white' : 'text-slate-700 bg-slate-50'}`}
                                                    >
                                                        <PlusCircle size={18} /> Raise a Grievance
                                                    </Link>
                                                    <Link
                                                        to="/rewards"
                                                        onClick={() => setIsMobileMenuOpen(false)}
                                                        className={`p-3.5 rounded-xl font-bold text-sm flex items-center gap-3 ${isActive('/rewards') ? 'bg-brand-blue text-white' : 'text-slate-700 bg-slate-50'}`}
                                                    >
                                                        <Trophy size={18} /> Rewards & Milestones
                                                    </Link>
                                                </>
                                            ) : user.role === 'admin' ? (
                                                <>
                                                    <Link
                                                        to="/admin"
                                                        onClick={() => setIsMobileMenuOpen(false)}
                                                        className={`p-3.5 rounded-xl font-bold text-sm flex items-center gap-3 ${isActive('/admin') ? 'bg-slate-900 text-white' : 'text-slate-700 bg-slate-50'}`}
                                                    >
                                                        <ShieldCheck size={18} /> Admin Matrix Portal
                                                    </Link>
                                                    <Link
                                                        to="/department"
                                                        onClick={() => setIsMobileMenuOpen(false)}
                                                        className={`p-3.5 rounded-xl font-bold text-sm flex items-center gap-3 ${isActive('/department') ? 'bg-slate-900 text-white' : 'text-slate-700 bg-slate-50'}`}
                                                    >
                                                        <Building2 size={18} /> Department Operations Feed
                                                    </Link>
                                                </>
                                            ) : (
                                                <>
                                                    <Link
                                                        to="/department"
                                                        onClick={() => setIsMobileMenuOpen(false)}
                                                        className={`p-3.5 rounded-xl font-bold text-sm flex items-center gap-3 ${isActive('/department') ? 'bg-amber-600 text-white' : 'text-slate-700 bg-slate-50'}`}
                                                    >
                                                        <Building2 size={18} /> Department Work Orders
                                                    </Link>
                                                    <Link
                                                        to="/home"
                                                        onClick={() => setIsMobileMenuOpen(false)}
                                                        className={`p-3.5 rounded-xl font-bold text-sm flex items-center gap-3 ${isActive('/home') ? 'bg-amber-600 text-white' : 'text-slate-700 bg-slate-50'}`}
                                                    >
                                                        <HomeIcon size={18} /> Division Overview
                                                    </Link>
                                                </>
                                            )}

                                            <button
                                                onClick={handleLogout}
                                                className="w-full p-3.5 mt-2 rounded-xl font-bold text-sm text-red-600 bg-red-50 hover:bg-red-100 flex items-center justify-center gap-2 transition-colors"
                                            >
                                                <LogOut size={18} /> Sign Out
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="grid grid-cols-1 gap-2.5 pt-2">
                                        <Link
                                            to="/login"
                                            onClick={() => setIsMobileMenuOpen(false)}
                                            className="p-3.5 rounded-xl font-bold text-sm text-slate-800 bg-slate-50 border border-slate-200 flex items-center justify-between"
                                        >
                                            <span className="flex items-center gap-2.5"><LogIn size={18} className="text-brand-blue" /> Citizen Login</span>
                                            <span className="text-xs text-brand-blue">Sign in →</span>
                                        </Link>
                                        <Link
                                            to="/register"
                                            onClick={() => setIsMobileMenuOpen(false)}
                                            className="p-3.5 rounded-xl font-bold text-sm text-white bg-brand-blue shadow-lg shadow-blue-500/20 flex items-center justify-between"
                                        >
                                            <span className="flex items-center gap-2.5"><UserPlus size={18} /> Citizen Sign Up</span>
                                            <span className="text-xs text-white/80">Join now →</span>
                                        </Link>
                                        <Link
                                            to="/department/login"
                                            onClick={() => setIsMobileMenuOpen(false)}
                                            className="p-3.5 rounded-xl font-bold text-sm text-amber-800 bg-amber-50 border border-amber-200 flex items-center justify-between"
                                        >
                                            <span className="flex items-center gap-2.5">🏢 Department Official Portal</span>
                                            <span className="text-xs text-amber-700">Enter →</span>
                                        </Link>
                                        <Link
                                            to="/admin/login"
                                            onClick={() => setIsMobileMenuOpen(false)}
                                            className="p-3.5 rounded-xl font-bold text-sm text-white bg-slate-900 flex items-center justify-between"
                                        >
                                            <span className="flex items-center gap-2.5">🏛️ Super Admin Matrix</span>
                                            <span className="text-xs text-slate-400">Access →</span>
                                        </Link>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </nav>

            {/* Mobile Bottom Quick Navigation Bar (Sticky for Touch Devices) */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-[100] bg-white/95 backdrop-blur-xl border-t border-slate-200/90 px-3 py-2 shadow-2xl safe-area-bottom">
                <div className="flex justify-around items-center">
                    {user ? (
                        user.role === 'citizen' ? (
                            <>
                                <Link 
                                    to="/citizen" 
                                    className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${isActive('/citizen') ? 'text-brand-blue font-black' : 'text-slate-400 font-bold'}`}
                                >
                                    <LayoutDashboard size={20} />
                                    <span className="text-[10px]">Portal</span>
                                </Link>
                                <Link 
                                    to="/report" 
                                    className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${isActive('/report') ? 'text-brand-blue font-black' : 'text-brand-orange font-bold'}`}
                                >
                                    <div className="w-7 h-7 -mt-3 bg-gradient-to-r from-amber-500 to-orange-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-orange-500/30">
                                        <PlusCircle size={18} />
                                    </div>
                                    <span className="text-[10px] text-brand-orange font-black">Report</span>
                                </Link>
                                <Link 
                                    to="/rewards" 
                                    className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${isActive('/rewards') ? 'text-brand-blue font-black' : 'text-slate-400 font-bold'}`}
                                >
                                    <Trophy size={20} />
                                    <span className="text-[10px]">Rewards</span>
                                </Link>
                                <button 
                                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                    className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${isMobileMenuOpen ? 'text-brand-blue font-black' : 'text-slate-400 font-bold'}`}
                                >
                                    <Menu size={20} />
                                    <span className="text-[10px]">Menu</span>
                                </button>
                            </>
                        ) : (
                            <>
                                <Link 
                                    to="/department" 
                                    className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${isActive('/department') ? 'text-brand-blue font-black' : 'text-slate-400 font-bold'}`}
                                >
                                    <Building2 size={20} />
                                    <span className="text-[10px]">Feed</span>
                                </Link>
                                {user.role === 'admin' ? (
                                    <Link 
                                        to="/admin" 
                                        className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${isActive('/admin') ? 'text-brand-blue font-black' : 'text-slate-400 font-bold'}`}
                                    >
                                        <ShieldCheck size={20} />
                                        <span className="text-[10px]">Admin</span>
                                    </Link>
                                ) : (
                                    <Link 
                                        to="/home" 
                                        className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${isActive('/home') ? 'text-brand-blue font-black' : 'text-slate-400 font-bold'}`}
                                    >
                                        <HomeIcon size={20} />
                                        <span className="text-[10px]">Overview</span>
                                    </Link>
                                )}
                                <button 
                                    onClick={handleLogout}
                                    className="flex flex-col items-center gap-1 py-1 px-3 text-red-500 font-bold rounded-xl"
                                >
                                    <LogOut size={20} />
                                    <span className="text-[10px]">Exit</span>
                                </button>
                            </>
                        )
                    ) : (
                        <>
                            <Link 
                                to="/" 
                                className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${isActive('/') ? 'text-brand-blue font-black' : 'text-slate-400 font-bold'}`}
                            >
                                <HomeIcon size={20} />
                                <span className="text-[10px]">Home</span>
                            </Link>
                            <Link 
                                to="/report" 
                                className="flex flex-col items-center gap-1 py-1 px-3 text-brand-orange font-bold rounded-xl"
                            >
                                <div className="w-7 h-7 -mt-3 bg-gradient-to-r from-amber-500 to-orange-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-orange-500/30">
                                    <PlusCircle size={18} />
                                </div>
                                <span className="text-[10px] text-brand-orange font-black">Report</span>
                            </Link>
                            <Link 
                                to="/login" 
                                className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${isActive('/login') ? 'text-brand-blue font-black' : 'text-slate-400 font-bold'}`}
                            >
                                <LogIn size={20} />
                                <span className="text-[10px]">Login</span>
                            </Link>
                            <button 
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${isMobileMenuOpen ? 'text-brand-blue font-black' : 'text-slate-400 font-bold'}`}
                            >
                                <Menu size={20} />
                                <span className="text-[10px]">Portals</span>
                            </button>
                        </>
                    )}
                </div>
            </div>
        </>
    );
};

export default Navbar;
