import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Mail, Phone, MapPin, Globe2, Zap, Layout } from 'lucide-react';

const Footer = () => {
    return (
        <footer className="bg-slate-900 text-white pt-20 pb-10">
            <div className="container mx-auto px-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
                    <div className="col-span-1 md:col-span-2">
                        <Link to="/" className="flex items-center gap-3 mb-6">
                            <img src="/JanSetuLogo.jpeg" alt="JanSetu" className="w-10 h-10 rounded-lg" />
                            <span className="text-2xl font-black tracking-tighter">Jan<span className="text-brand-orange">Setu</span></span>
                        </Link>
                        <p className="text-slate-400 max-w-sm mb-6 font-medium leading-relaxed">
                            Empowering citizens through transparent governance and AI-driven civic reporting. Built for the smart cities of tomorrow.
                        </p>
                        <div className="flex gap-4">
                            {[Globe2, Zap, Layout].map((Icon, i) => (
                                <a key={i} href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-brand-blue transition-colors">
                                    <Icon size={18} />
                                </a>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h4 className="text-lg font-bold mb-6">Quick Links</h4>
                        <ul className="space-y-4 text-slate-400 font-medium">
                            <li><Link to="/login" className="hover:text-white transition-colors">Login</Link></li>
                            <li><Link to="/register" className="hover:text-white transition-colors">Register</Link></li>
                            <li><Link to="/report" className="hover:text-white transition-colors">Report Issue</Link></li>
                            <li><Link to="/about" className="hover:text-white transition-colors">About Us</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="text-lg font-bold mb-6">Contact Us</h4>
                        <ul className="space-y-4 text-slate-400 font-medium">
                            <li className="flex items-center gap-3"><Mail size={18} className="text-brand-blue" /> support@jansetu.city</li>
                            <li className="flex items-center gap-3"><Phone size={18} className="text-brand-orange" /> +91 (800) 123-4567</li>
                            <li className="flex items-center gap-3"><MapPin size={18} className="text-brand-blue" /> City Hall, Digital Plaza, mangalore</li>
                        </ul>
                    </div>
                </div>

                <div className="border-t border-white/5 pt-10 text-center text-slate-500 font-bold text-sm uppercase tracking-widest">
                    <p>&copy; {new Date().getFullYear()} JanSetu Smart City. All rights reserved.</p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
