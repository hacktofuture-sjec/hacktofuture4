import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Footer from "../components/Footer";
import { 
    Zap, 
    ShieldCheck, 
    Users, 
    ArrowRight, 
    CheckCircle2, 
    BarChart3, 
    Globe2,
    Building2,
    MapPin,
    Sparkles,
    ShieldAlert,
    Cpu,
    Award,
    Activity,
    PhoneCall,
    Send
} from "lucide-react";

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="w-full min-h-screen bg-white text-slate-900 selection:bg-brand-blue/20 overflow-x-hidden pb-16 sm:pb-0">

      {/* Top Civic Authority Ribbon */}
      <div className="bg-slate-900 text-slate-200 text-[10px] sm:text-xs py-2 px-4 sm:px-6 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-1.5 sm:gap-2 text-center sm:text-left">
            <div className="flex items-center gap-2 font-medium">
                <span className="flex h-2 w-2 relative flex-shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="font-semibold text-white truncate">Smart Cities Mission</span> • National AI Civic Redressal Matrix
            </div>
            <div className="flex items-center gap-3 text-[10px] sm:text-[11px] font-semibold text-slate-400">
                <span className="hover:text-white transition-colors cursor-pointer" onClick={() => navigate('/department/login')}>
                    🏛️ Department Portal
                </span>
                <span>|</span>
                <span className="hover:text-white transition-colors cursor-pointer" onClick={() => navigate('/admin/login')}>
                    🛡️ Admin Matrix
                </span>
            </div>
        </div>
      </div>

      {/* Hero Section */}
      <section className="relative pt-10 pb-14 sm:pt-16 sm:pb-20 lg:pt-24 lg:pb-28 overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-50/50">
        {/* Ambient Background Accents */}
        <div className="absolute top-0 right-1/4 w-[400px] sm:w-[600px] h-[400px] sm:h-[600px] bg-blue-500/5 rounded-full blur-[140px] pointer-events-none"></div>
        <div className="absolute top-1/3 left-10 w-[300px] sm:w-[400px] h-[300px] sm:h-[400px] bg-amber-500/5 rounded-full blur-[120px] pointer-events-none"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
            
            {/* Text Content */}
            <motion.div
              className="lg:w-1/2 text-center lg:text-left"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-blue-50/90 border border-blue-200 rounded-full mb-5 shadow-xs">
                <Building2 size={13} className="text-brand-blue" />
                <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-brand-blue">
                    JanSetu • Smart Governance & Grievance Matrix
                </span>
              </div>
              
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 leading-[1.12] tracking-tight mb-5">
                AI-Powered Smart City <br />
                <span className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-600 bg-clip-text text-transparent">
                  Grievance Automation & Inspection Matrix
                </span>
              </h1>

              <p className="text-sm sm:text-base lg:text-lg text-slate-600 font-medium max-w-xl mb-8 sm:mb-10 leading-relaxed mx-auto lg:mx-0">
                A unified civic infrastructure empowering citizens to report grievances instantly via WhatsApp or Web, backed by AI neural routing, automated SLA tracking, and computer vision fraud auditing.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start">
                <button 
                  onClick={() => navigate('/report')}
                  className="group flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl font-black text-sm sm:text-base shadow-lg shadow-orange-500/20 active:scale-95 transition-all w-full sm:w-auto"
                >
                  <Send size={16} /> RAISE A GRIEVANCE <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>

                <button 
                  onClick={() => navigate('/department/login')}
                  className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-800 px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl font-black text-sm sm:text-base border-2 border-slate-200 hover:border-slate-300 shadow-xs active:scale-95 transition-all w-full sm:w-auto"
                >
                  <Building2 size={16} className="text-amber-600" /> DEPARTMENT PORTAL
                </button>

                <button 
                  onClick={() => navigate('/admin/login')}
                  className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 sm:px-6 py-3.5 sm:py-4 rounded-2xl font-black text-sm sm:text-base shadow-md active:scale-95 transition-all w-full sm:w-auto"
                >
                  <ShieldCheck size={16} className="text-blue-400" /> ADMIN MATRIX
                </button>
              </div>

              {/* Trust Indicators */}
              <div className="mt-8 sm:mt-10 pt-6 sm:pt-8 border-t border-slate-200/80 flex flex-wrap items-center justify-center lg:justify-start gap-4 sm:gap-8 text-[11px] sm:text-xs font-bold text-slate-500">
                <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={15} className="text-emerald-600" /> 100% SLA Deadlines
                </div>
                <div className="flex items-center gap-1.5">
                    <Cpu size={15} className="text-brand-blue" /> AI Computer Vision
                </div>
                <div className="flex items-center gap-1.5">
                    <MapPin size={15} className="text-amber-600" /> GPS Precise Lock
                </div>
              </div>
            </motion.div>

            {/* Visual Civic Hub Card */}
            <motion.div
              className="lg:w-1/2 relative w-full"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
            >
              <div className="relative rounded-3xl sm:rounded-[2.5rem] overflow-hidden border-4 sm:border-[8px] border-white shadow-xl sm:shadow-2xl bg-white group">
                <img
                  src="/smart_city_hub.jpg"
                  alt="JanSetu Smart City Municipal Command Center"
                  className="w-full h-[280px] sm:h-[400px] lg:h-[480px] object-cover group-hover:scale-105 transition-transform duration-700"
                />
                
                {/* Overlay Floating Stats Card */}
                <div className="absolute bottom-3 left-3 right-3 sm:bottom-6 sm:left-6 sm:right-6 bg-white/95 backdrop-blur-xl p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xl flex justify-between items-center">
                    <div>
                        <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-wider text-slate-400 mb-0.5">Municipal Response</p>
                        <p className="text-base sm:text-2xl font-black text-slate-900">24x7 Active</p>
                    </div>
                    <div className="w-px h-6 sm:h-8 bg-slate-200"></div>
                    <div>
                        <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-wider text-slate-400 mb-0.5">AI Quality Score</p>
                        <p className="text-base sm:text-2xl font-black text-emerald-600">99.4% Verified</p>
                    </div>
                    <div className="w-px h-6 sm:h-8 bg-slate-200"></div>
                    <div className="h-8 w-8 sm:h-11 sm:w-11 rounded-lg sm:rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-md flex-shrink-0">
                        <Activity size={16} />
                    </div>
                </div>

                {/* Top Badge */}
                <div className="absolute top-3 left-3 sm:top-4 sm:left-4 bg-slate-900/90 backdrop-blur-md text-white text-[9px] sm:text-[11px] font-black px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-lg sm:rounded-xl uppercase tracking-wider shadow">
                    🏛️ Municipal Command Headquarters
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Department Grid Banner */}
      <section className="py-6 sm:py-8 bg-white border-y border-slate-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <p className="text-center text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-4 sm:mb-6">
                Connected Municipal Line Departments
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 sm:gap-4">
                {[
                    { name: 'Sanitation', icon: '🧹', color: 'border-amber-200 bg-amber-50/60 text-amber-900' },
                    { name: 'Water Supply', icon: '💧', color: 'border-blue-200 bg-blue-50/60 text-blue-900' },
                    { name: 'Public Works', icon: '🏗️', color: 'border-emerald-200 bg-emerald-50/60 text-emerald-900' },
                    { name: 'Electric Board', icon: '⚡', color: 'border-purple-200 bg-purple-50/60 text-purple-900' },
                    { name: 'City Police', icon: '🚓', color: 'border-slate-200 bg-slate-50 text-slate-900' },
                    { name: 'Administration', icon: '🏛️', color: 'border-orange-200 bg-orange-50/60 text-orange-900' },
                ].map((d) => (
                    <div key={d.name} className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border ${d.color} flex flex-col items-center justify-center text-center shadow-xs`}>
                        <span className="text-xl sm:text-2xl mb-1">{d.icon}</span>
                        <span className="text-[11px] sm:text-xs font-black">{d.name}</span>
                    </div>
                ))}
            </div>
        </div>
      </section>

      {/* Core AI Platform Capabilities */}
      <section className="py-14 sm:py-24 bg-slate-50/60 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-16">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100/70 text-brand-blue rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider mb-3">
                <Zap size={13} /> Mission-Critical Architecture
            </div>
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight mb-3">
                Engineered for High-Accountability Redressal
            </h2>
            <p className="text-xs sm:text-base text-slate-500 font-medium max-w-2xl mx-auto">
                Real-time grievance lifecycle orchestration powered by state-of-the-art AI analysis and transparent departmental scoreboards.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 sm:gap-8">
            {/* Feature 1 */}
            <motion.div
              className="p-6 sm:p-8 bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-md hover:shadow-lg transition-all group"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-50 text-brand-blue rounded-2xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform shadow-inner">
                <Zap size={24} />
              </div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 mb-2 sm:mb-3">AI Triaging & SLA Allocation</h3>
              <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">
                Neural Groq engine processes grievance titles, assigns exact municipal divisions, computes severity matrices, and initiates automated countdown deadlines.
              </p>
            </motion.div>

            {/* Feature 2 */}
            <motion.div
              className="p-6 sm:p-8 bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-md hover:shadow-lg transition-all group"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              viewport={{ once: true }}
            >
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform shadow-inner">
                <BarChart3 size={24} />
              </div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 mb-2 sm:mb-3">
                Geospatial Hotspot Map
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">
                Unsupervised K-Means clustering aggregates localized complaint spikes across wards, equipping commissioners with predictive crisis radar.
              </p>
            </motion.div>

            {/* Feature 3 */}
            <motion.div
              className="p-6 sm:p-8 bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-md hover:shadow-lg transition-all group"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              viewport={{ once: true }}
            >
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform shadow-inner">
                <ShieldCheck size={24} />
              </div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 mb-2 sm:mb-3">AI Anti-Fraud Audit</h3>
              <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">
                Officers must upload photographic proof of work. Computer vision inspects before-and-after evidence to reject incomplete fixes and flag fraudulent closures.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 4-Step Governance Flow */}
      <section className="py-14 sm:py-20 bg-white border-t border-slate-200/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight mb-2">
                How JanSetu Operates
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-xl mx-auto">
                A transparent 4-stage pipeline connecting citizen awareness to municipal field resolution.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[
                { step: "01", title: "Citizen Submission", desc: "Report via Web Portal or Mobile PWA with auto-detected full GPS address & photo.", icon: Send, color: "text-blue-600 bg-blue-50 border-blue-200" },
                { step: "02", title: "AI Classification", desc: "Groq LLM classifies category, determines SLA deadline, and dispatches ticket.", icon: Cpu, color: "text-amber-600 bg-amber-50 border-amber-200" },
                { step: "03", title: "Field Action", desc: "Department engineers execute on-ground repair and upload resolution proof photo.", icon: Building2, color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
                { step: "04", title: "AI Verification", desc: "Vision AI verifies work quality, awards citizen reward points, and archives report.", icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
            ].map((s, index) => {
              const IconComp = s.icon;
              return (
                <div key={index} className="p-5 sm:p-6 bg-slate-50/70 rounded-2xl sm:rounded-3xl border border-slate-200 hover:bg-white hover:shadow-md transition-all relative">
                    <div className="flex justify-between items-start mb-3 sm:mb-4">
                        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl ${s.color} border flex items-center justify-center font-bold shadow-xs`}>
                            <IconComp size={20} />
                        </div>
                        <span className="text-xl sm:text-2xl font-black text-slate-300">
                            {s.step}
                        </span>
                    </div>
                    <h4 className="text-sm sm:text-base font-black text-slate-900 mb-1.5">{s.title}</h4>
                    <p className="text-[11px] sm:text-xs text-slate-500 font-medium leading-relaxed">{s.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-14 sm:py-20 bg-slate-900 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-brand-blue/10 rounded-full blur-[140px] pointer-events-none"></div>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-800 text-amber-400 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider mb-4 sm:mb-6">
            <Sparkles size={13} /> National Civic Transformation
          </div>

          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-4 sm:mb-6">
            Empower Your City with Real-Time Civic Accountability
          </h2>

          <p className="text-xs sm:text-base text-slate-300 font-medium max-w-2xl mx-auto mb-8 sm:mb-10">
            Join thousands of citizens and municipal officers collaborating to build cleaner, safer, and smarter urban infrastructure.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <button
                onClick={() => navigate('/report')}
                className="px-6 sm:px-8 py-3.5 sm:py-4 bg-brand-orange hover:bg-orange-600 text-white rounded-2xl font-black text-xs sm:text-sm uppercase tracking-wider shadow-xl shadow-orange-500/20 active:scale-95 transition-all w-full sm:w-auto"
            >
                Raise a Grievance Now
            </button>
            <button
                onClick={() => navigate('/department/register')}
                className="px-6 sm:px-8 py-3.5 sm:py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black text-xs sm:text-sm uppercase tracking-wider border border-slate-700 shadow-md active:scale-95 transition-all w-full sm:w-auto"
            >
                Register as Department Officer
            </button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default LandingPage;
