import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Mail, Phone, MapPin, Globe2, Zap, Layout } from 'lucide-react';

const Footer = () => {
    return (
        <footer className="bg-slate-900 text-white pt-12 sm:pt-20 pb-20 sm:pb-10">
            <div className="container mx-auto px-4 sm:px-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 sm:gap-12 mb-10 sm:mb-16">
                    <div className="col-span-1 sm:col-span-2">
                        <Link to="/" className="flex items-center gap-2.5 mb-4 sm:mb-6">
                            <img src="/JanSetuLogo.jpeg" alt="JanSetu" className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl" />
                            <span className="text-xl sm:text-2xl font-black tracking-tighter">Jan<span className="text-brand-orange">Setu</span></span>
                        </Link>
                        <p className="text-slate-400 max-w-sm mb-5 text-xs sm:text-sm font-medium leading-relaxed">
                            Empowering citizens through transparent governance and AI-driven civic reporting. Built for the smart cities of tomorrow.
                        </p>
                        <div className="flex gap-3">
                            {[Globe2, Zap, Layout].map((Icon, i) => (
                                <a key={i} href="#" className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-brand-blue transition-colors">
                                    <Icon size={16} />
                                </a>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h4 className="text-sm sm:text-base font-bold mb-3 sm:mb-6">Quick Links</h4>
                        <ul className="space-y-2.5 sm:space-y-3 text-xs sm:text-sm text-slate-400 font-medium">
                            <li><Link to="/login" className="hover:text-white transition-colors">Citizen Login</Link></li>
                            <li><Link to="/register" className="hover:text-white transition-colors">Sign Up</Link></li>
                            <li><Link to="/report" className="hover:text-white transition-colors">Raise Grievance</Link></li>
                            <li><Link to="/department/login" className="hover:text-white transition-colors">Department Portal</Link></li>
                            <li><Link to="/admin/login" className="hover:text-white transition-colors">Super Admin</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="text-sm sm:text-base font-bold mb-3 sm:mb-6">Contact Us</h4>
                        <ul className="space-y-2.5 sm:space-y-3 text-xs sm:text-sm text-slate-400 font-medium">
                            <li className="flex items-center gap-2"><Mail size={15} className="text-brand-blue flex-shrink-0" /> support@jansetu.city</li>
                            <li className="flex items-center gap-2"><Phone size={15} className="text-brand-orange flex-shrink-0" /> +91 (800) 123-4567</li>
                            <li className="flex items-center gap-2"><MapPin size={15} className="text-brand-blue flex-shrink-0" /> City Hall, Digital Plaza, Mangalore</li>
                        </ul>
                    </div>
                </div>

                <div className="border-t border-white/5 pt-6 sm:pt-8 text-center text-slate-500 font-bold text-[11px] sm:text-xs uppercase tracking-wider">
                    <p>&copy; {new Date().getFullYear()} JanSetu Smart City Platform. All rights reserved.</p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
