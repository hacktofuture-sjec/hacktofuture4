import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ArrowRight, Zap, Target, Award } from 'lucide-react';
import { motion } from 'framer-motion';

const Landing = () => {
  return (
    <div className="bg-white min-h-screen">
      {/* Simple Hero Section */}
      <section className="container mx-auto px-6 py-24 lg:py-40 flex flex-col items-center text-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-20 h-20 bg-blue-50 text-brand-blue rounded-3xl flex items-center justify-center mb-12 animate-float"
        >
          <ShieldCheck size={48} />
        </motion.div>

        <h1 className="text-6xl lg:text-8xl font-black text-slate-900 mb-8 tracking-tighter leading-tight">
          Connecting <span className="text-brand-blue">Vision,</span> <br /> 
          Enabling <span className="text-brand-orange italic">Action.</span>
        </h1>

        <p className="text-xl text-slate-500 max-w-2xl mb-16 font-medium leading-relaxed">
          JanSetu is your direct bridge to city administration. Report issues, track progress, and earn rewards for active civic contribution.
        </p>

        <div className="flex flex-col sm:flex-row gap-6">
          <Link to="/register" className="btn-blue text-lg px-12 group">
            Get Started <ArrowRight className="ml-2 group-hover:translate-x-2 transition-transform" />
          </Link>
          <Link to="/login" className="btn-outline text-lg px-12">
            Login
          </Link>
        </div>
      </section>

      {/* Trust & Features Section */}
      <section className="bg-slate-50 py-32 rounded-[100px] mx-6 mb-12">
        <div className="container mx-auto px-6 grid md:grid-cols-3 gap-12">
          <div className="text-center group">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-sm group-hover:shadow-xl group-hover:-translate-y-2 transition-all">
              <Zap className="text-brand-orange" />
            </div>
            <h3 className="text-xl font-bold mb-4">Fast Resolution</h3>
            <p className="text-slate-500">AI-driven routing ensures your grievances reach the correct department immediately.</p>
          </div>

          <div className="text-center group">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-sm group-hover:shadow-xl group-hover:-translate-y-2 transition-all">
              <Target className="text-brand-blue" />
            </div>
            <h3 className="text-xl font-bold mb-4">Precise Tracking</h3>
            <p className="text-slate-500">Get real-time updates and email notifications as city authorities work on your report.</p>
          </div>

          <div className="text-center group">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-sm group-hover:shadow-xl group-hover:-translate-y-2 transition-all">
              <Award className="text-green-500" />
            </div>
            <h3 className="text-xl font-bold mb-4">Civic Rewards</h3>
            <p className="text-slate-500">Earn recognition points for every complaint submitted and be a city champion.</p>
          </div>
        </div>
      </section>

      <footer className="py-12 text-center text-slate-400 font-bold text-sm">
        JanSetu • Smart City Initiative 2026
      </footer>
    </div>
  );
};

export default Landing;
