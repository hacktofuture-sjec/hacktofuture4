import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Footer from "../components/Footer";
import heroImg from "../assets/jansetu-govt-building.png";
import { 
    Zap, 
    ShieldCheck, 
    Users, 
    ArrowRight, 
    ChevronRight, 
    CheckCircle2, 
    BarChart3, 
    Globe2,
    PlusCircle 
} from "lucide-react";

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="w-full min-h-screen bg-white selection:bg-brand-blue/30 overflow-x-hidden">

      {/* Hero Section */}
      <section className="relative pt-32 pb-24 lg:pt-48 lg:pb-32 overflow-hidden bg-slate-950">
        {/* Background Gradients */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-brand-blue opacity-20 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 px-6"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-brand-orange opacity-10 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2"></div>
        
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-20">
            {/* Text Content */}
            <motion.div
              className="lg:w-1/2 text-center lg:text-left"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full mb-8 backdrop-blur-sm">
                <span className="w-2 h-2 rounded-full bg-brand-orange animate-pulse"></span>
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/70">Next-Gen Governance Live</span>
              </div>
              
              <h1 className="text-5xl md:text-5xl lg:text-6xl font-black text-white leading-[1.1] tracking-tighter mb-8">
                AI-Powered Smart City <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-blue to-blue-300 italic">Complaint Analysis & Automation System</span>
              </h1>

              <p className="text-xl text-slate-400 font-medium max-w-xl mb-12 leading-relaxed mx-auto lg:mx-0">
                JanSetu empowers citizens to report issues effortlessly while providing 
                authorities with AI-powered insights to build a faster, smarter city.
              </p>

              <div className="flex flex-col sm:flex-row gap-5 justify-center lg:justify-start">
                <button 
                  onClick={() => navigate('/report')}
                  className="group flex items-center justify-center gap-3 bg-brand-orange hover:bg-orange-600 text-white px-10 py-5 rounded-2xl font-black italic tracking-tighter text-xl transition-all shadow-xl shadow-orange-500/20"
                >
                  START REPORTING <ArrowRight size={24} className="group-hover:translate-x-2 transition-transform" />
                </button>

                <button 
                  onClick={() => navigate('/login')}
                  className="flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 text-white px-10 py-5 rounded-2xl font-black italic tracking-tighter text-xl border border-white/10 transition-all backdrop-blur-xl"
                >
                  AUTHORITY ACCESS
                </button>
              </div>
            </motion.div>

            {/* Visual Element */}
            <motion.div
              className="lg:w-1/2 relative"
              initial={{ opacity: 0, scale: 0.9, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.2 }}
            >
              <div className="relative z-10 rounded-[3rem] overflow-hidden border-8 border-white/10 shadow-2xl">
                <img
                  src={heroImg}
                  alt="JanSetu AI Government Hub"
                  className="w-full h-[500px] object-cover hover:scale-105 transition-transform duration-700"
                />
                
                {/* Floating Stats Card */}
                <div className="absolute bottom-8 left-8 right-8 bg-white/10 backdrop-blur-2xl p-6 rounded-3xl border border-white/10 flex justify-between items-center shadow-2xl">
                    <div className="text-left">
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-1">Total Impact</p>
                        <p className="text-3xl font-black text-white leading-none">50K+</p>
                    </div>
                    <div className="w-px h-10 bg-white/10"></div>
                    <div className="text-left px-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-1">SLA Rating</p>
                        <p className="text-3xl font-black text-brand-orange leading-none">99.2%</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-brand-blue flex items-center justify-center text-white">
                        <Globe2 size={24} />
                    </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-32 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center mb-24">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-brand-blue rounded-full text-xs font-black uppercase tracking-[0.2em] mb-6"
            >
                <Zap size={14} /> Powering The City
            </motion.div>
            <motion.h2
                className="text-5xl lg:text-7xl font-black text-slate-900 tracking-tighter mb-6"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
            >
                Innovation That <span className="text-brand-orange italic">Matters.</span>
            </motion.h2>
            <motion.p
                className="text-xl text-slate-500 font-medium max-w-2xl mx-auto"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
            >
                We use cutting-edge technology to bridge the gap between people and progress.
            </motion.p>
          </div>

          <div className="grid md:grid-cols-3 gap-10">
            {/* Feature 1 */}
            <motion.div
              className="p-12 bg-white rounded-[3rem] border border-slate-100 hover:border-brand-blue/30 shadow-xl hover:shadow-2xl transition-all group"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <div className="w-16 h-16 bg-blue-50 text-brand-blue rounded-2xl flex items-center justify-center mb-10 group-hover:scale-110 transition-transform">
                <Zap size={32} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-6">AI Issue Classification</h3>
              <p className="text-slate-500 font-medium leading-relaxed">
                Our advanced neural engines automatically categorize and route every report to the right department in milliseconds.
              </p>
            </motion.div>

            {/* Feature 2 */}
            <motion.div
              className="p-12 bg-orange-50/50 rounded-[3rem] border border-orange-100/50 group"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              viewport={{ once: true }}
            >
              <div className="w-16 h-16 bg-orange-500 text-white rounded-2xl flex items-center justify-center mb-10 group-hover:rotate-12 transition-transform">
                <BarChart3 size={32} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-2">
                Real-Time Ops <span className="px-3 py-1 bg-brand-orange text-white text-[10px] rounded-full">LIVE</span>
              </h3>
              <p className="text-slate-500 font-medium leading-relaxed">
                Authorities get a city-wide "Eye in the Sky" map to visualize hotspots and act before a crisis escalates.
              </p>
            </motion.div>

            {/* Feature 3 */}
            <motion.div
              className="p-12 bg-slate-950 rounded-[3rem] shadow-2xl relative overflow-hidden group"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              viewport={{ once: true }}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-blue opacity-10 blur-3xl group-hover:opacity-30 transition-opacity"></div>
              <div className="w-16 h-16 bg-white/10 text-brand-blue rounded-2xl flex items-center justify-center mb-10 border border-white/5">
                <ShieldCheck size={32} />
              </div>
              <h3 className="text-2xl font-black text-white mb-6">Unrivaled Transparency</h3>
              <p className="text-slate-400 font-medium leading-relaxed">
                Built on a mission-critical infrastructure, guaranteeing every citizen's voice is tracked from logging to resolution.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-32 bg-brand-blue text-white relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row items-end justify-between mb-24 gap-8 text-center lg:text-left">
            <div className="max-w-2xl">
                <h2 className="text-5xl lg:text-7xl font-black tracking-tighter italic leading-none mb-6">
                    THE FOUR <br />
                    <span className="text-transparent border-t-2 border-white/20 pt-4 bg-clip-text bg-gradient-to-r from-white to-white/40">PHASES of IMPACT.</span>
                </h2>
            </div>
            <p className="text-xl text-blue-100 font-bold max-w-sm mb-1">
                A streamlined pipeline from citizen report to government resolution.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-12">
            {[
                { title: "Report", icon: PlusCircle, color: "bg-white", text: "Submit issues via text, WhatsApp, or instant GPS pin." },
                { title: "Review", icon: Zap, color: "bg-brand-orange", text: "AI instantly classifies severity & detects duplicate patterns." },
                { title: "Active Logs", icon: BarChart3, color: "bg-blue-400", text: "Status is tracked in a transparent city-wide workforce ledger." },
                { title: "Resolution", icon: CheckCircle2, color: "bg-green-400", text: "Departments resolve the issue and taxpayers track real impact." }
            ].map((step, index) => (
              <motion.div
                key={index}
                className="relative p-10 bg-white/5 border border-white/10 rounded-[3rem] hover:bg-white/10 transition-all flex flex-col items-center text-center"
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <div className={`w-14 h-14 ${step.color} rounded-2xl flex items-center justify-center text-slate-900 mb-8 shadow-xl -mt-16`}>
                  <step.icon size={28} />
                </div>
                <h3 className="text-3xl font-black italic tracking-tighter mb-4">{step.title}</h3>
                <p className="font-bold opacity-60 leading-relaxed text-blue-50">
                  {step.text}
                </p>
                <div className="absolute top-10 right-10 text-[60px] font-black opacity-5 pointer-events-none">0{index + 1}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-40 bg-white relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-5xl h-64 bg-brand-orange/10 blur-[150px] opacity-30 rounded-full"></div>
        <div className="max-w-7xl mx-auto px-6 text-center relative z-10">
          <motion.h2
            className="text-6xl lg:text-9xl font-black text-slate-900 tracking-tighter italic leading-none mb-12"
            initial={{ scale: 0.9, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
          >
            BE THE CHANGE. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-orange to-red-500">JANSETU IS LIVE.</span>
          </motion.h2>

          <motion.p
            className="text-2xl text-slate-500 font-bold max-w-2xl mx-auto mb-16"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            Join thousands of citizens building the first transparent smart city together.
          </motion.p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <motion.button
                onClick={() => navigate('/register')}
                className="px-16 py-6 bg-brand-blue text-white rounded-full font-black text-xl italic tracking-tighter shadow-2xl hover:scale-105 transition-transform"
                whileHover={{ y: -5 }}
            >
                REGISTER NOW
            </motion.button>
            <motion.button
                onClick={() => navigate('/report')}
                className="px-16 py-6 border-4 border-slate-900 text-slate-900 rounded-full font-black text-xl italic tracking-tighter hover:bg-slate-900 hover:text-white transition-all hover:scale-105"
                whileHover={{ y: -5 }}
            >
                QUICK REPORT
            </motion.button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default LandingPage;
